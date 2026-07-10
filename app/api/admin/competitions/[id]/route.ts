import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Competition from '@/lib/models/Competition';
import Saison from '@/lib/models/Saison';
import Match from '@/lib/models/Match';
import AuditService from '@/lib/services/audit.service';
import { competitionUpdateSchema } from '@/lib/validators/competition';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    await connectDB();
    const comp = await Competition.findOne({ _id: params.id, organizationId: orgId })
      .populate('saisonId')
      .populate('clubsParticipants')
      .populate('disciplinaryRuleSetId');

    if (!comp) {
      return NextResponse.json({ error: 'Compétition introuvable' }, { status: 404 });
    }

    return NextResponse.json(comp);
  } catch (error) {
    return apiError(error, `GET /api/admin/competitions/${params.id}`);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    const { id } = params;
    await connectDB();

    const comp = await Competition.findOne({ _id: id, organizationId: orgId });
    if (!comp) {
      return NextResponse.json({ error: 'Compétition introuvable' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = competitionUpdateSchema.parse(body);

    const before = comp.toObject();

    // Map fields
    if (parsed.nom !== undefined) comp.nom = parsed.nom;
    if (parsed.type !== undefined) comp.type = parsed.type;
    if (parsed.niveau !== undefined) comp.niveau = parsed.niveau;
    if (parsed.formatCompetition !== undefined) comp.formatCompetition = parsed.formatCompetition;
    if (parsed.reglementPoints !== undefined) {
      comp.reglementPoints = {
        ...comp.reglementPoints,
        ...parsed.reglementPoints,
      };
    }
    if (parsed.active !== undefined) comp.active = parsed.active;
    if (parsed.status !== undefined) comp.status = parsed.status;
    if (parsed.isOfficial !== undefined) comp.isOfficial = parsed.isOfficial;
    if (parsed.tieBreakers !== undefined) comp.tieBreakers = parsed.tieBreakers;
    if (parsed.disciplinaryRuleSetId !== undefined) {
      comp.disciplinaryRuleSetId = parsed.disciplinaryRuleSetId 
        ? new mongoose.Types.ObjectId(parsed.disciplinaryRuleSetId) as any
        : undefined;
    }

    await comp.save();

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'COMPETITION_UPDATED',
      entityType: 'Competition',
      entityId: comp._id,
      before,
      after: comp.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(comp);
  } catch (error) {
    return apiError(error, `PUT /api/admin/competitions/${params.id}`);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    const { id } = params;
    await connectDB();

    const comp = await Competition.findOne({ _id: id, organizationId: orgId });
    if (!comp) {
      return NextResponse.json({ error: 'Compétition introuvable' }, { status: 404 });
    }

    // Check if linked to any matches
    const hasMatches = await Match.exists({ competitionId: id });
    if (hasMatches) {
      return NextResponse.json(
        { error: 'Impossible de supprimer cette compétition car elle contient des matchs' },
        { status: 400 }
      );
    }

    const before = comp.toObject();
    await Competition.deleteOne({ _id: id });

    // Pull from Saison reference list
    await Saison.updateOne(
      { _id: comp.saisonId },
      { $pull: { competitions: id } }
    );

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'COMPETITION_DELETED',
      entityType: 'Competition',
      entityId: id,
      before,
      organizationId: orgId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, `DELETE /api/admin/competitions/${params.id}`);
  }
}
