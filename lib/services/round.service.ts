import mongoose from 'mongoose';
import Round from '../models/Round';
import Match from '../models/Match';
import connectDB from '../db';

export class RoundService {
  /**
   * Évalue si tous les matchs d'une journée (Round) sont terminés/homologués
   * ou portent un statut d'annulation/report explicite (§5.9 de la spécification).
   * Si oui, met à jour le statut du Round en 'COMPLETED'. Sinon, le remet en 'ACTIVE'.
   */
  static async checkRoundCompletion(
    roundId: string | mongoose.Types.ObjectId,
    organizationId?: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    await connectDB();

    const matches = await Match.find({
      roundId,
      ...(organizationId ? { organizationId } : {}),
    });
    if (matches.length === 0) {
      return false;
    }

    // Un match est considéré traité s'il est homologué (officiel)
    // OU s'il a été reporté ou annulé explicitement.
    const isCompleted = matches.every(
      (m) => m.homologue === true || ['Reporté', 'Annulé'].includes(m.statut)
    );

    const round = await Round.findOne({
      _id: roundId,
      ...(organizationId ? { organizationId } : {}),
    });
    if (round) {
      const newStatus = isCompleted ? 'COMPLETED' : 'ACTIVE';
      if (round.status !== newStatus) {
        round.status = newStatus;
        await round.save();
      }
    }

    return isCompleted;
  }
}

export default RoundService;
