import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Round from '@/lib/models/Round';
import Competition from '@/lib/models/Competition';
import Match from '@/lib/models/Match';
import AuditService from '@/lib/services/audit.service';
import { z } from 'zod';

export const runtime = 'nodejs';

const roundCreateSchema = z.object({
  competitionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  number: z.number().int().min(1),
  name: z.string().min(1).trim(),
  dateDebut: z.string().or(z.date()).transform(val => new Date(val)),
  dateFin: z.string().or(z.date()).transform(val => new Date(val)),
});

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    await connectDB();
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get('competitionId');

    const query: any = { organizationId: orgId };
    if (competitionId) {
      query.competitionId = competitionId;
    }

    const rounds = await Round.find(query).sort({ number: 1 }).lean();
    const roundsWithCounts = await Promise.all(rounds.map(async (r) => {
      const matchesCount = await Match.countDocuments({ roundId: r._id });
      return {
        ...r,
        matchesCount,
      };
    }));
    return NextResponse.json(roundsWithCounts);
  } catch (error) {
    return apiError(error, 'GET /api/admin/rounds');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    await connectDB();
    const body = await req.json();
    const parsed = roundCreateSchema.parse(body);

    const comp = await Competition.findOne({ _id: parsed.competitionId, organizationId: orgId });
    if (!comp) {
      return NextResponse.json({ error: 'Compétition introuvable' }, { status: 400 });
    }

    // Check unique number within competition
    const existing = await Round.findOne({ competitionId: parsed.competitionId, number: parsed.number });
    if (existing) {
      return NextResponse.json(
        { error: 'Une journée avec ce numéro existe déjà pour cette compétition' },
        { status: 400 }
      );
    }

    const round = await Round.create({
      organizationId: orgId,
      competitionId: parsed.competitionId,
      saisonId: comp.saisonId,
      number: parsed.number,
      name: parsed.name,
      dateDebut: parsed.dateDebut,
      dateFin: parsed.dateFin,
      status: 'DRAFT',
      active: true,
    });

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'ROUND_CREATED',
      entityType: 'Round',
      entityId: round._id,
      after: round.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(round, { status: 201 });
  } catch (error) {
    return apiError(error, 'POST /api/admin/rounds');
  }
}
