import { NextResponse } from 'next/server';
import { requireAdmin, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import Suspension from '@/lib/models/Suspension';
import RedCardDecisionService from '@/lib/services/red-card-decision.service';
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
    const status = url.searchParams.get('status') || 'PROVISIONAL';

    const filter: Record<string, unknown> = {
      organizationId: orgId,
      suspensionType: { $in: ['RED_CARD_PROVISIONAL', 'RED_CARD_FINAL'] },
    };
    if (status !== 'ALL') filter.status = status;

    const [suspensions, total] = await Promise.all([
      Suspension.find(filter)
        .populate('joueurId', 'nom prenom numeroMaillot')
        .populate('clubId', 'nom code logo')
        .populate('sourceMatchId', 'date scoreHome scoreAway statut competitionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Suspension.countDocuments(filter),
    ]);

    return NextResponse.json({ suspensions, total, page: Number(url.searchParams.get('page') || 1), limit });
  } catch (error) {
    return apiError(error, 'GET /api/admin/discipline/red-decisions');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId!;
    await connectDB();

    const body = await req.json();
    const { suspensionId, totalMatches, scope, competitionId, decisionDate, decisionReference, decisionReason, matchesMissedPreDecision } = body;

    if (!suspensionId || !totalMatches || !decisionReference || !decisionReason) {
      return NextResponse.json(
        { error: 'Champs obligatoires : suspensionId, totalMatches, decisionReference, decisionReason' },
        { status: 400 }
      );
    }

    const suspension = await RedCardDecisionService.recordDecision(
      suspensionId,
      {
        totalMatches,
        scope: scope || 'ALL_COMPETITIONS',
        competitionId,
        decisionDate: decisionDate ? new Date(decisionDate) : new Date(),
        decisionReference,
        decisionReason,
        matchesMissedPreDecision: matchesMissedPreDecision || 0,
        actorId: session.user.id!,
        organizationId: orgId,
      }
    );

    return NextResponse.json({ suspension });
  } catch (error: any) {
    if (error.message) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return apiError(error, 'POST /api/admin/discipline/red-decisions');
  }
}
