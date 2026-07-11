import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';

export const runtime = 'nodejs';

/**
 * Meilleurs buteurs d'une compétition — agrégés depuis les événements
 * des matchs homologués (source de vérité), jamais depuis des compteurs.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 10), 25);

    const scorers = await Match.aggregate([
      { $match: { competitionId: new mongoose.Types.ObjectId(id), homologue: true } },
      { $unwind: '$evenements' },
      {
        $match: {
          'evenements.type': 'But',
          'evenements.joueurId': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$evenements.joueurId', goals: { $sum: 1 } } },
      { $sort: { goals: -1, _id: 1 } },
      { $limit: limit },
      {
        $lookup: { from: 'joueurs', localField: '_id', foreignField: '_id', as: 'joueur' },
      },
      { $unwind: '$joueur' },
      {
        $lookup: { from: 'clubs', localField: 'joueur.clubId', foreignField: '_id', as: 'club' },
      },
      { $unwind: { path: '$club', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          goals: 1,
          'joueur._id': 1,
          'joueur.nom': 1,
          'joueur.prenom': 1,
          'joueur.numeroMaillot': 1,
          'joueur.photo': 1,
          'joueur.position': 1,
          'club._id': 1,
          'club.nom': 1,
          'club.code': 1,
          'club.logo': 1,
        },
      },
    ]);

    return NextResponse.json({ scorers });
  } catch (error) {
    return apiError(error, 'GET /api/admin/competitions/[id]/top-scorers');
  }
}
