import mongoose from 'mongoose';
import Match from '../models/Match';
import Round from '../models/Round';
import RoundService from './round.service';
import StandingsService from './standings.service';
import AuditService from './audit.service';
import { DisciplineEngine } from './discipline-engine';
import { SuspensionService } from './suspension.service';
import connectDB from '../db';

export interface FinalizationResult {
  matchId: string;
  status: 'finalized' | 'already_finalized' | 'error';
  error?: string;
}

/**
 * MatchFinalizationService
 *
 * §5.4 requirements:
 *   - Atomic (MongoDB transaction)
 *   - Idempotent (processingVersion claim)
 *   - Protected against concurrent calls (atomic version increment)
 *   - Audited
 *   - Score vs. goal-event validation
 *   - Round completion check after each finalization
 *   - Standings rebuild after each finalization
 *
 * NOTE: Yellow/red card discipline wiring is in Phase 5.
 * This service leaves hooks where Phase 5 will plug in.
 */
export class MatchFinalizationService {
  /**
   * Finalise a single match. Idempotent — safe to call twice.
   */
  static async finalizeMatch(
    matchId: string | mongoose.Types.ObjectId,
    actorId: string,
    organizationId: string | mongoose.Types.ObjectId
  ): Promise<FinalizationResult> {
    await connectDB();

    // ── 1. Pre-flight: load match without transaction ────────────────────────
    const match = await Match.findOne({ _id: matchId, organizationId });
    if (!match) {
      return { matchId: matchId.toString(), status: 'error', error: 'Match introuvable' };
    }

    // Already finalized — idempotent return
    if (match.homologue) {
      return { matchId: matchId.toString(), status: 'already_finalized' };
    }

    if (match.statut === 'Reporté' || match.statut === 'Annulé') {
      return {
        matchId: matchId.toString(),
        status: 'error',
        error: `Impossible de finaliser un match avec statut '${match.statut}'`,
      };
    }

    // ── 2. Validation ────────────────────────────────────────────────────────
    const validationError = this._validateMatch(match);
    if (validationError) {
      return { matchId: matchId.toString(), status: 'error', error: validationError };
    }

    // ── 3. Atomic processingVersion claim — prevents concurrent finalization ─
    const claimedVersion = match.processingVersion;
    const claimResult = await Match.findOneAndUpdate(
      { _id: matchId, processingVersion: claimedVersion, homologue: false },
      { $inc: { processingVersion: 1 } },
      { new: true }
    );

    if (!claimResult) {
      // Another process won the race — return already_finalized
      return { matchId: matchId.toString(), status: 'already_finalized' };
    }

    // ── 4. Transaction: write finalization ──────────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Mark finalized
      await Match.findByIdAndUpdate(
        matchId,
        {
          homologue: true,
          statut: 'Terminé',
          validePar: new mongoose.Types.ObjectId(actorId),
          dateValidation: new Date(),
        },
        { session }
      );

      // Audit inside the transaction
      await AuditService.logWithSession(
        {
          actor: { id: actorId, role: 'FTF_ADMIN' },
          action: 'MATCH_FINALIZED',
          entityType: 'Match',
          entityId: matchId,
          after: {
            scoreHome: match.scoreHome,
            scoreAway: match.scoreAway,
            statut: 'Terminé',
            homologue: true,
          },
          organizationId: organizationId.toString(),
        },
        session
      );

      // ── 5. Discipline Engine (inside transaction) ────────────────────────
      // Processes card events → creates DisciplinaryCard + auto-suspensions
      try {
        await DisciplineEngine.processMatchCards(
          {
            _id: matchId,
            competitionId: match.competitionId,
            saisonId: match.saisonId,
            roundId: match.roundId,
            organizationId: match.organizationId,
            isOfficial: match.isOfficial,
            homeClubId: match.homeClubId,
            awayClubId: match.awayClubId,
            evenements: match.evenements || [],
          },
          session
        );
      } catch (err) {
        console.error('[MatchFinalizationService] DisciplineEngine error (non-fatal in tx):', err);
      }

      await session.commitTransaction();
      session.endSession();

      // ── 5. Post-commit: rebuild standings + check round completion ─────────
      // (non-transactional, can be retried independently)
      try {
        await StandingsService.rebuildCompetitionStandings(
          match.competitionId.toString(),
          actorId
        );
      } catch (err) {
        console.error('[MatchFinalizationService] Standings rebuild error (non-fatal):', err);
      }

      if (match.roundId) {
        try {
          await RoundService.checkRoundCompletion(match.roundId);
        } catch (err) {
          console.error('[MatchFinalizationService] Round completion check error (non-fatal):', err);
        }
      }

      // ── 6. Post-commit: suspension serving ──────────────────────────────
      // SuspensionService must run AFTER commit to use stable match state
      try {
        await SuspensionService.processServingForMatch(
          matchId,
          organizationId
        );
      } catch (err) {
        console.error('[MatchFinalizationService] SuspensionService error (non-fatal):', err);
      }

      return { matchId: matchId.toString(), status: 'finalized' };
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  /**
   * Validate match data before finalization.
   * Returns an error string, or null if valid.
   */
  private static _validateMatch(match: any): string | null {
    // Score must be non-negative integers
    if (
      typeof match.scoreHome !== 'number' ||
      typeof match.scoreAway !== 'number' ||
      match.scoreHome < 0 ||
      match.scoreAway < 0
    ) {
      return 'Les scores doivent être des entiers non négatifs';
    }

    // Goal event count must match score (only if events are present)
    if (match.evenements && match.evenements.length > 0) {
      const homeGoals = match.evenements.filter(
        (e: any) => e.type === 'But' && e.equipe === 'home'
      ).length;
      const awayGoals = match.evenements.filter(
        (e: any) => e.type === 'But' && e.equipe === 'away'
      ).length;

      // Only validate if both sides have goal events assigned
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

  /**
   * Reschedule a postponed match to a new date.
   */
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
    if (match.notes) {
      match.notes = `${match.notes}\n[Reporté] ${reason}`;
    } else {
      match.notes = `[Reporté] ${reason}`;
    }
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
