import { NextResponse } from 'next/server';
import { requireClub, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import DisciplinaryCard from '@/lib/models/DisciplinaryCard';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const cardType = searchParams.get('cardType');
    const saisonId = searchParams.get('saisonId');
    const { skip, limit } = parsePagination(searchParams);

    const query: any = { clubId };
    if (cardType) query.cardType = cardType;
    if (saisonId) query.saisonId = saisonId;

    const cards = await DisciplinaryCard.find(query)
      .populate('joueurId', 'nom prenom numeroMaillot')
      .populate('matchId', 'date scoreHome scoreAway statut')
      .populate('competitionId', 'nom')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await DisciplinaryCard.countDocuments(query);

    return NextResponse.json({ cards, total });
  } catch (error) {
    return apiError(error, 'GET /api/club/cards');
  }
}
