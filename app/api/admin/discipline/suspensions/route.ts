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
    const status = url.searchParams.get('status');
    const joueurId = url.searchParams.get('joueurId');
    const clubId = url.searchParams.get('clubId');
    const suspensionType = url.searchParams.get('suspensionType');

    const filter: Record<string, unknown> = { organizationId: orgId };
    if (status) filter.status = status;
    if (joueurId) filter.joueurId = joueurId;
    if (clubId) filter.clubId = clubId;
    if (suspensionType) filter.suspensionType = suspensionType;

    const [suspensions, total] = await Promise.all([
      Suspension.find(filter)
        .populate('joueurId', 'nom prenom numeroMaillot')
        .populate('clubId', 'nom code logo')
        .populate('sourceMatchId', 'date scoreHome scoreAway')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Suspension.countDocuments(filter),
    ]);

    return NextResponse.json({ suspensions, total, page: Number(url.searchParams.get('page') || 1), limit });
  } catch (error) {
    return apiError(error, 'GET /api/admin/discipline/suspensions');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    await connectDB();

    const body = await req.json();
    const {
      joueurId, clubId, suspensionType, scope, matchesSuspended, competitionId,
      decisionReference, decisionReason, notes,
    } = body;

    if (!joueurId || !clubId || !suspensionType || !matchesSuspended) {
      return NextResponse.json(
        { error: 'Champs obligatoires : joueurId, clubId, suspensionType, matchesSuspended' },
        { status: 400 }
      );
    }

    const suspension = await Suspension.create({
      organizationId: orgId,
      joueurId,
      clubId,
      sourceSeasonId: body.sourceSeasonId,
      suspensionType: suspensionType || 'MANUAL',
      status: 'ACTIVE',
      scope: scope || 'ALL_OFFICIAL_COMPETITIONS',
      competitionId: competitionId || undefined,
      matchesSuspended,
      matchesServed: 0,
      matchesRemaining: matchesSuspended,
      decisionReference,
      decisionReason,
      notes,
      createdBy: session.user.id,
    });

    return NextResponse.json({ suspension }, { status: 201 });
  } catch (error) {
    return apiError(error, 'POST /api/admin/discipline/suspensions');
  }
}
