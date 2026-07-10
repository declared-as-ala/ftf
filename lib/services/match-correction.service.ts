import mongoose from 'mongoose';
import Match from '../models/Match';
import StandingsService from './standings.service';
import AuditService from './audit.service';
import connectDB from '../db';

/**
 * MatchCorrectionService — Reopen a finalized match
 *
 * §5.5 requirements:
 *   - FTF_ADMIN only
 *   - Mandatory reason
 *   - Audit entry + transaction
 *   - Does NOT delete suspensions (Phase 5 rebuilds them deterministically)
 *   - Rebuilds standings deterministically after reopen
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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const before = {
        statut: match.statut,
        homologue: match.homologue,
        scoreHome: match.scoreHome,
        scoreAway: match.scoreAway,
      };

      await Match.findByIdAndUpdate(
        matchId,
        {
          homologue: false,
          statut: 'Brouillon',
          reopenReason: reason.trim(),
          reopenedBy: new mongoose.Types.ObjectId(actorId),
          reopenedAt: new Date(),
          validePar: undefined,
          dateValidation: undefined,
        },
        { session }
      );

      await AuditService.logWithSession(
        {
          actor: { id: actorId, role: 'FTF_ADMIN' },
          action: 'MATCH_REOPENED',
          entityType: 'Match',
          entityId: matchId,
          before,
          after: { statut: 'Brouillon', homologue: false, reason },
          organizationId: organizationId.toString(),
        },
        session
      );

      await session.commitTransaction();
      session.endSession();

      // Rebuild standings deterministically (Phase 5 will also rebuild suspensions)
      try {
        await StandingsService.rebuildCompetitionStandings(
          match.competitionId.toString(),
          actorId
        );
      } catch (err) {
        console.error('[MatchCorrectionService] Standings rebuild error (non-fatal):', err);
      }

      return await Match.findById(matchId);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }
}

export default MatchCorrectionService;
