import { NextResponse } from 'next/server';
import { requireClub, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import '@/lib/models/Joueur';
import '@/lib/models/Club';
import '@/lib/models/Competition';
import '@/lib/models/Saison';
import '@/lib/models/Arbitre';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { id } = params;

    const match = await Match.findById(id)
      .populate('homeClubId', 'nom logo')
      .populate('awayClubId', 'nom logo')
      .populate('competitionId', 'nom')
      .populate('saisonId', 'nom')
      .populate('arbitrePrincipalId', 'nom prenom')
      .populate('evenements.joueurId', 'nom prenom numeroMaillot clubId')
      .lean();

    if (!match) {
      throw new ApiError(404, 'Match introuvable');
    }

    const isParticipant =
      match.homeClubId?._id?.toString() === clubId ||
      match.awayClubId?._id?.toString() === clubId;
    if (!isParticipant) {
      throw new ApiError(403, 'Accès refusé');
    }

    const goals = (match.evenements || []).filter((ev: any) => ev.type === 'But' && ev.equipe);
    match.scoreHome = goals.filter((ev: any) => ev.equipe === 'home').length;
    match.scoreAway = goals.filter((ev: any) => ev.equipe === 'away').length;

    return NextResponse.json(match);
  } catch (error) {
    return apiError(error, 'GET /api/club/matches/[id]');
  }
}
