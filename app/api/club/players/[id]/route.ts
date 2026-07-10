import { NextResponse } from 'next/server';
import { requireClub, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Joueur from '@/lib/models/Joueur';
import DisciplinaryCard from '@/lib/models/DisciplinaryCard';
import Suspension from '@/lib/models/Suspension';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { id } = await params;

    const joueur = await Joueur.findOne({ _id: id, clubId }).lean();
    if (!joueur) {
      throw new ApiError(404, 'Joueur introuvable');
    }

    const [cards, suspensions] = await Promise.all([
      DisciplinaryCard.find({ joueurId: id, clubId })
        .populate('matchId', 'scoreHome scoreAway date statut')
        .sort({ createdAt: -1 })
        .lean(),
      Suspension.find({ joueurId: id, clubId })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return NextResponse.json({ joueur, cards, suspensions });
  } catch (error) {
    return apiError(error, 'GET /api/club/players/[id]');
  }
}
