import { NextResponse } from 'next/server';
import { requireAdmin, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import DisciplinaryCard from '@/lib/models/DisciplinaryCard';
import '@/lib/models/Joueur';
import '@/lib/models/Club';
import '@/lib/models/Match';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;

    await connectDB();

    const url = new URL(req.url);
    const { skip, limit } = parsePagination(url.searchParams, { defaultLimit: 50 });
    const saisonId = url.searchParams.get('saisonId');
    const cardType = url.searchParams.get('cardType');
    const accumulationStatus = url.searchParams.get('accumulationStatus');
    const joueurId = url.searchParams.get('joueurId');
    const clubId = url.searchParams.get('clubId');

    const filter: Record<string, unknown> = { organizationId: orgId };
    if (saisonId) filter.saisonId = saisonId;
    if (cardType) filter.cardType = cardType;
    if (accumulationStatus) filter.accumulationStatus = accumulationStatus;
    if (joueurId) filter.joueurId = joueurId;
    if (clubId) filter.clubId = clubId;

    const [cards, total] = await Promise.all([
      DisciplinaryCard.find(filter)
        .populate('joueurId', 'nom prenom numeroMaillot')
        .populate('clubId', 'nom code logo')
        .populate('matchId', 'date journee scoreHome scoreAway statut')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DisciplinaryCard.countDocuments(filter),
    ]);

    return NextResponse.json({ cards, total, page: Number(url.searchParams.get('page') || 1), limit });
  } catch (error) {
    return apiError(error, 'GET /api/admin/discipline/cards');
  }
}
