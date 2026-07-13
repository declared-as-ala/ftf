import mongoose from 'mongoose';
import Match from '../models/Match';
import DisciplinaryCard from '../models/DisciplinaryCard';
import Suspension from '../models/Suspension';
import SuspensionServiceEntry from '../models/SuspensionServiceEntry';
import AuditService from './audit.service';
import MatchProjectionService from './match-projection.service';
import connectDB from '../db';

export class MatchCorrectionRebuildRequiredError extends Error {
  constructor() {
    super(
      'Réouverture bloquée : ce match possède des effets disciplinaires. ' +
        'La migration vers les événements canoniques est requise pour les reconstruire sans perte.'
    );
    this.name = 'MatchCorrectionRebuildRequiredError';
  }
}

/** Safe reopen path. Discipline-bearing matches remain blocked until Sprint 11.2. */
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

    // Embedded events have no stable source identity. Reversing one discipline
    // chain could corrupt later accumulations or serving entries, so fail closed.
    const [cards, sourceSuspensions, servingEntries] = await Promise.all([
      DisciplinaryCard.countDocuments({ organizationId, matchId }),
      Suspension.countDocuments({ organizationId, sourceMatchId: matchId }),
      SuspensionServiceEntry.countDocuments({ organizationId, matchId }),
    ]);
    if (cards > 0 || sourceSuspensions > 0 || servingEntries > 0) {
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
        const reopened = await Match.findOneAndUpdate(
          {
            _id: matchId,
            organizationId,
            homologue: true,
            processingVersion: match.processingVersion,
          },
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

        await MatchProjectionService.enqueueWithSession(
          {
            organizationId,
            matchId,
            competitionId: reopened.competitionId,
            roundId: reopened.roundId,
            processingVersion: nextVersion,
          },
          session
        );

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
