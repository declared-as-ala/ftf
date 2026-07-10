import { NextResponse } from 'next/server';
import { requireClub, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get('statut');
    const competitionId = searchParams.get('competitionId');
    const { skip, limit } = parsePagination(searchParams);

    const query: any = {
      $or: [{ homeClubId: clubId }, { awayClubId: clubId }],
    };
    if (statut) query.statut = statut;
    if (competitionId) query.competitionId = competitionId;

    const matches = await Match.find(query)
      .populate('homeClubId awayClubId competitionId saisonId', 'nom logo nom nom')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Match.countDocuments(query);

    return NextResponse.json({ matches, total });
  } catch (error) {
    return apiError(error, 'GET /api/club/matches');
  }
}
