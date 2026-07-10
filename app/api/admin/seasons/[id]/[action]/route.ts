import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Saison from '@/lib/models/Saison';
import AuditService from '@/lib/services/audit.service';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    const { id, action } = await params;
    if (!['activate', 'complete', 'archive'].includes(action)) {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }

    await connectDB();

    const season = await Saison.findOne({ _id: id, organizationId: orgId });
    if (!season) {
      return NextResponse.json({ error: 'Saison introuvable' }, { status: 404 });
    }

    const before = season.toObject();

    if (action === 'activate') {
      // Deactivate all other seasons in the organization
      await Saison.updateMany(
        { organizationId: orgId, _id: { $ne: id } },
        { $set: { isCurrent: false, active: false } }
      );

      season.active = true;
      season.status = 'ACTIVE';
      season.isCurrent = true;
    } else if (action === 'complete') {
      season.active = false;
      season.status = 'COMPLETED';
      season.isCurrent = false;
    } else if (action === 'archive') {
      season.active = false;
      season.status = 'ARCHIVED';
      season.isCurrent = false;
    }

    await season.save();

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: `SEASON_${action.toUpperCase()}`,
      entityType: 'Saison',
      entityId: season._id,
      before,
      after: season.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(season);
  } catch (error) {
    return apiError(error, `POST /api/admin/seasons/${(await params).id}/${(await params).action}`);
  }
}
