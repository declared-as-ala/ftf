import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Round from '@/lib/models/Round';
import Match from '@/lib/models/Match';
import AuditService from '@/lib/services/audit.service';
import { z } from 'zod';

export const runtime = 'nodejs';

const roundUpdateSchema = z.object({
  name: z.string().min(1).trim().optional(),
  dateDebut: z.string().or(z.date()).transform(val => new Date(val)).optional(),
  dateFin: z.string().or(z.date()).transform(val => new Date(val)).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    const { id } = await params;
    await connectDB();

    const round = await Round.findOne({ _id: id, organizationId: orgId });
    if (!round) {
      return NextResponse.json({ error: 'Journée introuvable' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = roundUpdateSchema.parse(body);

    const before = round.toObject();

    if (parsed.name !== undefined) round.name = parsed.name;
    if (parsed.dateDebut !== undefined) round.dateDebut = parsed.dateDebut;
    if (parsed.dateFin !== undefined) round.dateFin = parsed.dateFin;
    if (parsed.status !== undefined) round.status = parsed.status;
    if (parsed.active !== undefined) round.active = parsed.active;

    await round.save();

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'ROUND_UPDATED',
      entityType: 'Round',
      entityId: round._id,
      before,
      after: round.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(round);
  } catch (error) {
    return apiError(error, `PUT /api/admin/rounds/${(await params).id}`);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    const { id } = await params;
    await connectDB();

    const round = await Round.findOne({ _id: id, organizationId: orgId });
    if (!round) {
      return NextResponse.json({ error: 'Journée introuvable' }, { status: 404 });
    }

    // Check if linked to any matches
    const hasMatches = await Match.exists({ roundId: id });
    if (hasMatches) {
      return NextResponse.json(
        { error: 'Impossible de supprimer cette journée car elle contient des rencontres' },
        { status: 400 }
      );
    }

    const before = round.toObject();
    await Round.deleteOne({ _id: id });

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'ROUND_DELETED',
      entityType: 'Round',
      entityId: id,
      before,
      organizationId: orgId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, `DELETE /api/admin/rounds/${(await params).id}`);
  }
}
