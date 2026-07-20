import mongoose from 'mongoose';
import Match from '../models/Match';
import MatchEvent from '../models/MatchEvent';
import AuditService from './audit.service';
import { DisciplineEngine } from './discipline-engine';
import { SuspensionService } from './suspension.service';
import MatchProjectionService from './match-projection.service';
import connectDB from '../db';

export interface FinalizationResult {
  matchId: string;
  status: 'finalized' | 'already_finalized' | 'error';
  error?: string;
}

/** Atomic and idempotent officialization of one match. */
export class MatchFinalizationService {
  static async finalizeMatch(
    matchId: string | mongoose.Types.ObjectId,
    actorId: string,
    organizationId: string | mongoose.Types.ObjectId
  ): Promise<FinalizationResult> {
    await connectDB();

    const match = await Match.findOne({ _id: matchId, organizationId });
    if (!match) {
      return { matchId: matchId.toString(), status: 'error', error: 'Match introuvable' };
    }

    if (match.homologue) {
      await MatchProjectionService.processPendingForMatch(matchId, organizationId, actorId);
      return { matchId: matchId.toString(), status: 'already_finalized' };
    }

    if (match.statut === 'Reporté' || match.statut === 'Annulé') {
      return {
        matchId: matchId.toString(),
        status: 'error',
        error: `Impossible de finaliser un match avec statut '${match.statut}'`,
      };
    }

    const validationError = this._validateMatch(match);
    if (validationError) {
      return { matchId: matchId.toString(), status: 'error', error: validationError };
    }

    const claimedVersion = match.processingVersion;
    let finalized = false;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const claimedMatch = await Match.findOneAndUpdate(
          {
            _id: matchId,
            organizationId,
            processingVersion: claimedVersion,
            homologue: false,
          },
          {
            $inc: { processingVersion: 1 },
            $set: {
              homologue: true,
              statut: 'Terminé',
              validePar: new mongoose.Types.ObjectId(actorId),
              dateValidation: new Date(),
            },
          },
          { new: true, session }
        );

        if (!claimedMatch) return;
        finalized = true;

        const canonicalEvents = await MatchEvent.find({
          organizationId,
          matchId,
          status: 'DRAFT',
        }).session(session);
        if (canonicalEvents.length > 0) {
          const active = canonicalEvents.filter((event) => event.status !== 'CANCELLED');
          const derived = this._deriveCanonicalScore(claimedMatch, active);
          const mismatch = derived.home !== claimedMatch.scoreHome || derived.away !== claimedMatch.scoreAway;
          if (mismatch && !claimedMatch.scoreOverride?.explanation) {
            throw new Error(`Le score saisi ne correspond pas aux buts enregistrés (${derived.home}-${derived.away}).`);
          }
          await MatchEvent.updateMany(
            { organizationId, matchId, status: 'DRAFT' },
            { $set: { status: 'CONFIRMED' } },
            { session }
          );
        }

        // Required discipline effects are not best-effort. Any exception aborts
        // officialization, cards, suspensions, ledger, notifications and audit.
        await DisciplineEngine.processMatchCards(
          {
            _id: claimedMatch._id,
            competitionId: claimedMatch.competitionId,
            saisonId: claimedMatch.saisonId,
            roundId: claimedMatch.roundId,
            organizationId: claimedMatch.organizationId,
            isOfficial: claimedMatch.isOfficial,
            homeClubId: claimedMatch.homeClubId,
            awayClubId: claimedMatch.awayClubId,
            date: claimedMatch.date,
            evenements: claimedMatch.evenements || [],
            canonicalEvents,
          },
          session
        );

        await SuspensionService.processServingForMatch(matchId, organizationId, session);

        await MatchProjectionService.enqueueWithSession(
          {
            organizationId,
            matchId,
            competitionId: claimedMatch.competitionId,
            roundId: claimedMatch.roundId,
            processingVersion: claimedMatch.processingVersion,
          },
          session
        );

        await AuditService.logWithSession(
          {
            actor: { id: actorId, role: 'FTF_ADMIN' },
            action: 'MATCH_FINALIZED',
            entityType: 'Match',
            entityId: matchId,
            before: {
              statut: match.statut,
              homologue: false,
              processingVersion: claimedVersion,
            },
            after: {
              scoreHome: claimedMatch.scoreHome,
              scoreAway: claimedMatch.scoreAway,
              statut: 'Terminé',
              homologue: true,
              processingVersion: claimedMatch.processingVersion,
            },
            organizationId: organizationId.toString(),
          },
          session
        );
      });
    } finally {
      await session.endSession();
    }

    // These projections are rebuildable, but their durable task records were
    // committed with the match. Failure leaves FAILED work for a safe retry.
    await MatchProjectionService.processPendingForMatch(matchId, organizationId, actorId);

    return {
      matchId: matchId.toString(),
      status: finalized ? 'finalized' : 'already_finalized',
    };
  }

  private static _validateMatch(match: any): string | null {
    if (
      !Number.isInteger(match.scoreHome) ||
      !Number.isInteger(match.scoreAway) ||
      match.scoreHome < 0 ||
      match.scoreAway < 0
    ) {
      return 'Les scores doivent être des entiers non négatifs';
    }

    if (match.evenements && match.evenements.length > 0) {
      const homeGoals = match.evenements.filter(
        (event: any) => event.type === 'But' && event.equipe === 'home'
      ).length;
      const awayGoals = match.evenements.filter(
        (event: any) => event.type === 'But' && event.equipe === 'away'
      ).length;

      if (homeGoals > 0 || awayGoals > 0) {
        if (homeGoals !== match.scoreHome) {
          return `Incohérence : ${homeGoals} but(s) marqué(s) à domicile, score indique ${match.scoreHome}`;
        }
        if (awayGoals !== match.scoreAway) {
          return `Incohérence : ${awayGoals} but(s) marqué(s) à l'extérieur, score indique ${match.scoreAway}`;
        }
      }
    }

    return null;
  }

  private static _deriveCanonicalScore(match: any, events: any[]) {
    let home = 0;
    let away = 0;
    for (const event of events) {
      if (!['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(event.type)) continue;
      const isHomeClub = event.clubId.toString() === match.homeClubId.toString();
      const creditsHome = event.type === 'OWN_GOAL' ? !isHomeClub : isHomeClub;
      if (creditsHome) home += 1;
      else away += 1;
    }
    return { home, away };
  }

  static async rescheduleMatch(
    matchId: string | mongoose.Types.ObjectId,
    newDate: Date,
    reason: string,
    actorId: string,
    organizationId: string | mongoose.Types.ObjectId
  ) {
    await connectDB();

    const match = await Match.findOne({ _id: matchId, organizationId });
    if (!match) throw new Error('Match introuvable');
    if (match.homologue) throw new Error('Match homologué — modification interdite');

    const before = { date: match.date, statut: match.statut };
    match.date = newDate;
    match.statut = 'Programmé';
    match.notes = match.notes
      ? `${match.notes}\n[Reporté] ${reason}`
      : `[Reporté] ${reason}`;
    await match.save();

    await AuditService.log({
      actor: { id: actorId, role: 'FTF_ADMIN' },
      action: 'MATCH_RESCHEDULED',
      entityType: 'Match',
      entityId: matchId,
      before,
      after: { date: newDate, statut: 'Programmé', reason },
      organizationId: organizationId.toString(),
    });

    return match;
  }
}

export default MatchFinalizationService;
