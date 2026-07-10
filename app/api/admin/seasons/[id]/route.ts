import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Saison from '@/lib/models/Saison';
import Competition from '@/lib/models/Competition';
import AuditService from '@/lib/services/audit.service';
import { seasonUpdateSchema } from '@/lib/validators/season';

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
    const season = await Saison.findOne({ _id: params.id, organizationId: orgId })
      .populate('competitions')
      .populate('clubs');

    if (!season) {
      return NextResponse.json({ error: 'Saison introuvable' }, { status: 404 });
    }

    return NextResponse.json(season);
  } catch (error) {
    return apiError(error, `GET /api/admin/seasons/${params.id}`);
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

    const season = await Saison.findOne({ _id: id, organizationId: orgId });
    if (!season) {
      return NextResponse.json({ error: 'Saison introuvable' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = seasonUpdateSchema.parse(body);

    const before = season.toObject();

    // Map fields
    if (parsed.nom !== undefined) season.nom = parsed.nom;
    if (parsed.anneeDebut !== undefined) season.anneeDebut = parsed.anneeDebut;
    if (parsed.anneeFin !== undefined) season.anneeFin = parsed.anneeFin;
    if (parsed.dateDebut !== undefined) season.dateDebut = parsed.dateDebut;
    if (parsed.dateFin !== undefined) season.dateFin = parsed.dateFin;
    if (parsed.status !== undefined) season.status = parsed.status;
    if (parsed.configuration !== undefined) {
      season.configuration = {
        ...season.configuration,
        ...parsed.configuration,
      };
    }

    await season.save();

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'SEASON_UPDATED',
      entityType: 'Saison',
      entityId: season._id,
      before,
      after: season.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(season);
  } catch (error) {
    return apiError(error, `PUT /api/admin/seasons/${params.id}`);
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

    const season = await Saison.findOne({ _id: id, organizationId: orgId });
    if (!season) {
      return NextResponse.json({ error: 'Saison introuvable' }, { status: 404 });
    }

    // Check if linked to any competitions
    const linked = await Competition.exists({ saisonId: id });
    if (linked) {
      return NextResponse.json(
        { error: 'Impossible de supprimer cette saison car elle contient des compétitions' },
        { status: 400 }
      );
    }

    const before = season.toObject();
    await Saison.deleteOne({ _id: id });

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'SEASON_DELETED',
      entityType: 'Saison',
      entityId: id,
      before,
      organizationId: orgId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, `DELETE /api/admin/seasons/${params.id}`);
  }
}
