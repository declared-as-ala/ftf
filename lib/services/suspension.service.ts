import mongoose from 'mongoose';
import Match from '../models/Match';
import Competition from '../models/Competition';
import Suspension from '../models/Suspension';
import SuspensionServiceEntry from '../models/SuspensionServiceEntry';
import { NotificationService } from './notification.service';
import type { ServingReason } from '../models/SuspensionServiceEntry';

/**
 * SuspensionService — serving engine
 *
 * R-008: per (suspension, match) pair:
 *   - Is the match official? Did it start? Was it completed? Interrupted? Forfeit?
 *   - Is the competition in scope?
 *   - Is this entry already in the ledger? → ALREADY_COUNTED
 *
 * §5.8, §6.5: unique (suspensionId, matchId) on SuspensionServiceEntry
 * prevents double-decrement.
 */
export class SuspensionService {
  /**
   * Process serving for all active suspensions of both clubs after a match is finalized.
   * Called AFTER commit in finalization pipeline.
   */
  static async processServingForMatch(
    matchId: string | mongoose.Types.ObjectId,
    organizationId: string | mongoose.Types.ObjectId
  ) {
    const match = await Match.findById(matchId).lean();
    if (!match) return;

    const competition = await Competition.findById(match.competitionId).lean();

    const clubIds = [match.homeClubId.toString(), match.awayClubId.toString()];

    // Find all active suspensions for both clubs
    const activeSuspensions = await Suspension.find({
      clubId: { $in: clubIds },
      status: { $in: ['ACTIVE', 'PROVISIONAL'] },
      matchesRemaining: { $gt: 0 },
    });

    for (const suspension of activeSuspensions) {
      await this._evaluateAndRecord(suspension, match, competition, organizationId);
    }
  }

  private static async _evaluateAndRecord(
    suspension: any,
    match: any,
    competition: any,
    organizationId: any
  ) {
    // Check for existing ledger entry (prevents double-decrement)
    const existing = await SuspensionServiceEntry.findOne({
      suspensionId: suspension._id,
      matchId: match._id,
    });
    if (existing) return; // ALREADY_COUNTED path

    // PROVISIONAL suspensions (red card) — player stays out, but no match decrement
    // until a final decision is recorded. We still record the entry.
    if (suspension.status === 'PROVISIONAL') {
      await SuspensionServiceEntry.create({
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
      });
      return;
    }

    // Evaluate countability
    const { counted, reason } = this._evaluateCountability(suspension, match, competition);

    const remainingBefore = suspension.matchesRemaining;
    const remainingAfter = counted ? Math.max(0, remainingBefore - 1) : remainingBefore;

    // Write ledger entry (will fail silently on duplicate key — safe)
    try {
      await SuspensionServiceEntry.create({
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
      });
    } catch (err: any) {
      if (err.code === 11000) return; // Duplicate key — already counted
      throw err;
    }

    if (counted) {
      suspension.matchesServed += 1;
      suspension.matchesRemaining = remainingAfter;

      if (remainingAfter <= 0) {
        suspension.status = 'SERVED';
        await suspension.save();

        // Notify club
        setImmediate(async () => {
          try {
            await NotificationService.notify({
              organizationId: organizationId.toString(),
              recipientClubId: suspension.clubId.toString(),
              type: 'SUSPENSION_SERVED',
              subject: 'Suspension purgée — joueur à nouveau disponible',
              body: 'La suspension d\'un joueur a été entièrement purgée. Il est maintenant disponible.',
              dedupeKey: `SUSPENSION_SERVED:${suspension._id}`,
              entityType: 'Suspension',
              entityId: suspension._id.toString(),
            });
          } catch {}
        });
      } else {
        await suspension.save();
      }
    }
  }

  private static _evaluateCountability(
    suspension: any,
    match: any,
    competition: any
  ): { counted: boolean; reason: ServingReason } {
    // R-002: Not an official match
    if (!match.isOfficial) {
      return { counted: false, reason: 'NOT_OFFICIAL' };
    }

    // Match never started
    if (match.statut === 'Annulé') {
      return { counted: false, reason: 'NO_KICKOFF_DOES_NOT_COUNT' };
    }

    // Forfeit — R-008: doesn't count if player's own club caused it
    if (match.statut === 'Forfait') {
      const clubIsHome = match.homeClubId.toString() === suspension.clubId.toString();
      const clubCausedForfeit =
        (match.forfeitCause === 'HOME' && clubIsHome) ||
        (match.forfeitCause === 'AWAY' && !clubIsHome) ||
        match.forfeitCause === 'BOTH';

      if (clubCausedForfeit) {
        return { counted: false, reason: 'CLUB_ABSENT_DOES_NOT_COUNT' };
      }
      return { counted: true, reason: 'FORFEIT_COUNTS' };
    }

    // Scope: SAME_COMPETITION — must be the same competition
    if (suspension.scope === 'SAME_COMPETITION') {
      if (suspension.competitionId?.toString() !== match.competitionId.toString()) {
        return { counted: false, reason: 'WRONG_COMPETITION' };
      }
    }

    // Abandoned/interrupted — counts per R-008 default
    if (match.statut === 'Abandonné') {
      return { counted: true, reason: 'INTERRUPTED_MATCH_COUNTS' };
    }

    // Postponed
    if (match.statut === 'Reporté') {
      return { counted: false, reason: 'NO_KICKOFF_DOES_NOT_COUNT' };
    }

    // Standard finalized official match
    if (match.homologue) {
      return { counted: true, reason: 'OFFICIAL_MATCH_PLAYED' };
    }

    return { counted: false, reason: 'NO_KICKOFF_DOES_NOT_COUNT' };
  }
}

export default SuspensionService;
