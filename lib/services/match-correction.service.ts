import mongoose from 'mongoose';
import Match from '../models/Match';
import DisciplinaryCard from '../models/DisciplinaryCard';
import Suspension from '../models/Suspension';
import SuspensionServiceEntry from '../models/SuspensionServiceEntry';
import AuditService from './audit.service';
import MatchProjectionService from './match-projection.service';
import MatchEvent from '../models/MatchEvent';
import NotificationService from './notification.service';
import connectDB from '../db';

export class MatchCorrectionRebuildRequiredError extends Error {
  constructor() {
    super(
      'Réouverture bloquée : ce match possède des effets disciplinaires sans identifiant canonique. ' +
        'Contactez le support technique pour migrer les données.'
    );
    this.name = 'MatchCorrectionRebuildRequiredError';
  }
}

/**
 * MatchCorrectionService — Sprint 11.2
 *
 * Canonical event replay on reopen:
 * - Cards with `sourceEventId` are reversed cleanly.
 * - Derived suspensions (sourceMatchId) are cancelled.
 * - Serving entries are reversed and suspension counters decremented.
 * - Canonical events are reset from CONFIRMED → DRAFT.
 * - Only blocks for the true legacy case: cards WITHOUT sourceEventId AND no
 *   canonical events (no safe way to identify which event caused which card).
 */
export class MatchCorrectionService {
  static async reopenMatch(
    matchId: string | mongoose.Types.ObjectId,
    reason: string,
    actorId: string,
    organizationId: string | mongoose.Types.ObjectId
  ) {
    await connectDB();

    if (!reason || reason.trim().length < 5) {
      throw new Error('Une raison de réouverture (minimum 5 caractères) est obligatoire');
    }

    const match = await Match.findOne({ _id: matchId, organizationId });
    if (!match) throw new Error('Match introuvable');
    if (!match.homologue) throw new Error('Ce match n\'est pas encore homologué');

    const [cards, sourceSuspensions, servingEntries, canonicalEventCount] = await Promise.all([
      DisciplinaryCard.find({ organizationId, matchId }),
      Suspension.find({ organizationId, sourceMatchId: matchId }),
      SuspensionServiceEntry.find({ organizationId, matchId, reversedAt: { $exists: false } }),
      MatchEvent.countDocuments({ organizationId, matchId }),
    ]);

    // Only block for true legacy case: untracked cards with no canonical events
    const legacyUntrackedCards = cards.filter((c) => !c.sourceEventId);
    if (legacyUntrackedCards.length > 0 && canonicalEventCount === 0) {
      throw new MatchCorrectionRebuildRequiredError();
    }

    const before = {
      statut: match.statut,
      homologue: match.homologue,
      scoreHome: match.scoreHome,
      scoreAway: match.scoreAway,
      processingVersion: match.processingVersion,
    };
    const nextVersion = match.processingVersion + 1;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Claim and reopen atomically
        const reopened = await Match.findOneAndUpdate(
          { _id: matchId, organizationId, homologue: true, processingVersion: match.processingVersion },
          {
            $set: {
              homologue: false,
              statut: 'Brouillon',
              reopenReason: reason.trim(),
              reopenedBy: new mongoose.Types.ObjectId(actorId),
              reopenedAt: new Date(),
            },
            $unset: { validePar: 1, dateValidation: 1 },
            $inc: { processingVersion: 1 },
          },
          { new: true, session }
        );
        if (!reopened) throw new Error('Conflit de réouverture du match');

        // 2. Reverse serving entries
        for (const entry of servingEntries) {
          if (entry.counted) {
            await Suspension.updateOne(
              { _id: entry.suspensionId, organizationId },
              { $inc: { matchesServed: -1, matchesRemaining: 1 }, $set: { status: 'ACTIVE' } },
              { session }
            );
          }
          await SuspensionServiceEntry.updateOne(
            { _id: entry._id, organizationId },
            { $set: { reversedAt: new Date(), reversedBy: actorId, reversalReason: reason.trim() } },
            { session }
          );
        }

        // 3. Cancel source suspensions and restore accumulation on linked cards
        const sourceSuspensionIds = sourceSuspensions.map((item) => item._id);
        if (sourceSuspensionIds.length) {
          await Suspension.updateMany(
            { _id: { $in: sourceSuspensionIds }, organizationId },
            { $set: { status: 'CANCELLED', cancelledReason: reason.trim(), cancelledBy: actorId, cancelledAt: new Date() } },
            { session }
          );
          await DisciplinaryCard.updateMany(
            { organizationId, linkedSuspensionId: { $in: sourceSuspensionIds }, matchId: { $ne: matchId } },
            { $set: { accumulationStatus: 'ACTIVE' }, $unset: { linkedSuspensionId: 1 } },
            { session }
          );
        }

        // 4. Cancel all cards from this match. sourceEventId is unset (and
        // preserved as previousSourceEventId) so a later re-finalize of the
        // same canonical event doesn't collide with this card's own history
        // on the unique sourceEventId index.
        await DisciplinaryCard.updateMany(
          { organizationId, matchId },
          [
            {
              $set: {
                accumulationStatus: 'CANCELLED',
                cancelledReason: reason.trim(),
                cancelledBy: actorId,
                cancelledAt: new Date(),
                previousSourceEventId: '$sourceEventId',
              },
            },
            { $unset: 'sourceEventId' },
          ],
          { session }
        );

        // 5. Reset canonical events → DRAFT (can be re-edited and re-confirmed)
        await MatchEvent.updateMany(
          { organizationId, matchId, status: 'CONFIRMED' },
          { $set: { status: 'DRAFT' } },
          { session }
        );

        // 6. Notify clubs
        for (const clubId of [match.homeClubId, match.awayClubId]) {
          await NotificationService.notify(
            {
              organizationId: organizationId.toString(),
              recipientClubId: clubId.toString(),
              type: 'MATCH_REOPENED',
              subject: 'Résultat en cours de correction',
              body: 'La FTF a rouvert ce match. Les informations officielles seront republiées après validation.',
              dedupeKey: `MATCH_REOPENED:${matchId}:${nextVersion}:${clubId}`,
              entityType: 'Match',
              entityId: matchId.toString(),
            },
            session
          );
        }

        // 7. Enqueue projection tasks
        await MatchProjectionService.enqueueWithSession(
          { organizationId, matchId, competitionId: reopened.competitionId, roundId: reopened.roundId, processingVersion: nextVersion },
          session
        );

        // 8. Audit
        await AuditService.logWithSession(
          {
            actor: { id: actorId, role: 'FTF_ADMIN' },
            action: 'MATCH_REOPENED',
            entityType: 'Match',
            entityId: matchId,
            before,
            after: {
              statut: 'Brouillon',
              homologue: false,
              reason: reason.trim(),
              processingVersion: nextVersion,
              cardsReversed: cards.length,
              suspensionsCancelled: sourceSuspensionIds.length,
              servingEntriesReversed: servingEntries.length,
              canonicalEventsReset: canonicalEventCount,
            },
            reason: reason.trim(),
            organizationId: organizationId.toString(),
          },
          session
        );
      });
    } finally {
      await session.endSession();
    }

    await MatchProjectionService.processPendingForMatch(matchId, organizationId, actorId);
    return Match.findOne({ _id: matchId, organizationId });
  }
}

export default MatchCorrectionService;
