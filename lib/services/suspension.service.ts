import mongoose from 'mongoose';
import Match from '../models/Match';
import Competition from '../models/Competition';
import Suspension from '../models/Suspension';
import SuspensionServiceEntry from '../models/SuspensionServiceEntry';
import { NotificationService } from './notification.service';
import type { ServingReason } from '../models/SuspensionServiceEntry';

/** R-008 suspension serving engine with an idempotent per-match ledger. */
export class SuspensionService {
  /**
   * When called without a session this method owns a transaction. Match
   * finalization passes its transaction so officialization, ledger and decrement
   * either commit together or all roll back.
   */
  static async processServingForMatch(
    matchId: string | mongoose.Types.ObjectId,
    organizationId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ) {
    if (session) {
      return this._processServingForMatch(matchId, organizationId, session);
    }

    const ownedSession = await mongoose.startSession();
    try {
      await ownedSession.withTransaction(async () => {
        await this._processServingForMatch(matchId, organizationId, ownedSession);
      });
    } finally {
      await ownedSession.endSession();
    }
  }

  private static async _processServingForMatch(
    matchId: string | mongoose.Types.ObjectId,
    organizationId: string | mongoose.Types.ObjectId,
    session: mongoose.ClientSession
  ) {
    const match = await Match.findOne({ _id: matchId, organizationId })
      .session(session)
      .lean();
    if (!match) return;

    const competition = await Competition.findOne({
      _id: match.competitionId,
      organizationId,
    })
      .session(session)
      .lean();

    const clubIds = [match.homeClubId, match.awayClubId];
    const activeSuspensions = await Suspension.find({
      organizationId,
      clubId: { $in: clubIds },
      status: { $in: ['ACTIVE', 'PROVISIONAL'] },
      matchesRemaining: { $gt: 0 },
      // A suspension created by this match starts at the next applicable match.
      sourceMatchId: { $ne: match._id },
    }).session(session);

    for (const suspension of activeSuspensions) {
      await this._evaluateAndRecord(
        suspension,
        match,
        competition,
        organizationId,
        session
      );
    }
  }

  private static async _evaluateAndRecord(
    suspension: any,
    match: any,
    competition: any,
    organizationId: string | mongoose.Types.ObjectId,
    session: mongoose.ClientSession
  ) {
    const existing = await SuspensionServiceEntry.findOne({
      organizationId,
      suspensionId: suspension._id,
      matchId: match._id,
    }).session(session);
    if (existing) return;

    if (suspension.status === 'PROVISIONAL') {
      await SuspensionServiceEntry.create(
        [
          {
            organizationId,
            suspensionId: suspension._id,
            matchId: match._id,
            joueurId: suspension.joueurId,
            clubId: suspension.clubId,
            counted: false,
            reason: 'OFFICIAL_MATCH_PLAYED' as ServingReason,
            remainingBefore: suspension.matchesRemaining,
            remainingAfter: suspension.matchesRemaining,
            processedAt: new Date(),
            processedBy: 'SYSTEM',
            notes: 'Suspension provisoire — en attente de décision',
          },
        ],
        { session }
      );
      return;
    }

    const { counted, reason } = this._evaluateCountability(suspension, match, competition);
    const remainingBefore = suspension.matchesRemaining;
    const remainingAfter = counted ? Math.max(0, remainingBefore - 1) : remainingBefore;

    try {
      await SuspensionServiceEntry.create(
        [
          {
            organizationId,
            suspensionId: suspension._id,
            matchId: match._id,
            joueurId: suspension.joueurId,
            clubId: suspension.clubId,
            counted,
            reason,
            remainingBefore,
            remainingAfter,
            processedAt: new Date(),
            processedBy: 'SYSTEM',
          },
        ],
        { session }
      );
    } catch (error: any) {
      if (error.code === 11000) return;
      throw error;
    }

    if (!counted) return;

    const updated = await Suspension.findOneAndUpdate(
      {
        _id: suspension._id,
        organizationId,
        status: 'ACTIVE',
        matchesRemaining: remainingBefore,
      },
      {
        $inc: { matchesServed: 1, matchesRemaining: -1 },
        ...(remainingAfter <= 0 ? { $set: { status: 'SERVED' } } : {}),
      },
      { new: true, session }
    );
    if (!updated) {
      throw new Error('Conflit de traitement de suspension');
    }

    if (remainingAfter <= 0) {
      await NotificationService.notify(
        {
          organizationId: organizationId.toString(),
          recipientClubId: suspension.clubId.toString(),
          type: 'SUSPENSION_SERVED',
          subject: 'Suspension purgée — joueur à nouveau disponible',
          body: 'La suspension d\'un joueur a été entièrement purgée. Il est maintenant disponible.',
          dedupeKey: `SUSPENSION_SERVED:${suspension._id}`,
          entityType: 'Suspension',
          entityId: suspension._id.toString(),
        },
        session
      );
    }
  }

  private static _evaluateCountability(
    suspension: any,
    match: any,
    competition: any
  ): { counted: boolean; reason: ServingReason } {
    if (!match.isOfficial) {
      return { counted: false, reason: 'NOT_OFFICIAL' };
    }

    if (match.statut === 'Annulé') {
      return { counted: false, reason: 'NO_KICKOFF_DOES_NOT_COUNT' };
    }

    if (match.statut === 'Forfait') {
      const clubIsHome = match.homeClubId.toString() === suspension.clubId.toString();
      const clubCausedForfeit =
        (match.forfeitCause === 'HOME' && clubIsHome) ||
        (match.forfeitCause === 'AWAY' && !clubIsHome) ||
        match.forfeitCause === 'BOTH';

      return clubCausedForfeit
        ? { counted: false, reason: 'CLUB_ABSENT_DOES_NOT_COUNT' }
        : { counted: true, reason: 'FORFEIT_COUNTS' };
    }

    if (
      suspension.scope === 'SAME_COMPETITION' &&
      suspension.competitionId?.toString() !== match.competitionId.toString()
    ) {
      return { counted: false, reason: 'WRONG_COMPETITION' };
    }

    if (
      suspension.scope === 'SAME_CATEGORY' &&
      suspension.category &&
      suspension.category !== competition?.category
    ) {
      return { counted: false, reason: 'WRONG_CATEGORY' };
    }

    if (match.statut === 'Abandonné') {
      return { counted: true, reason: 'INTERRUPTED_MATCH_COUNTS' };
    }

    if (match.statut === 'Reporté' || match.statut === 'Replay Ordonné') {
      return { counted: false, reason: 'NO_KICKOFF_DOES_NOT_COUNT' };
    }

    return match.homologue
      ? { counted: true, reason: 'OFFICIAL_MATCH_PLAYED' }
      : { counted: false, reason: 'NO_KICKOFF_DOES_NOT_COUNT' };
  }
}

export default SuspensionService;
