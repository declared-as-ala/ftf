import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Competition from '@/lib/models/Competition';
import Club from '@/lib/models/Club';
import AuditService from '@/lib/services/audit.service';
import { competitionClubsSchema } from '@/lib/validators/competition';

export const runtime = 'nodejs';

export async function POST(
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
    const parsed = competitionClubsSchema.parse(body);
    const { clubIds } = parsed;

    // Verify all clubs exist and belong to the organization
    const count = await Club.countDocuments({ _id: { $in: clubIds }, organizationId: orgId });
    if (count !== clubIds.length) {
      return NextResponse.json(
        { error: 'Certains clubs sont introuvables ou n’appartiennent pas à cette organisation' },
        { status: 400 }
      );
    }

    const before = comp.toObject();
    comp.clubsParticipants = clubIds.map(cid => new mongoose.Types.ObjectId(cid));
    await comp.save();

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'COMPETITION_CLUBS_REGISTERED',
      entityType: 'Competition',
      entityId: comp._id,
      before,
      after: comp.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(comp);
  } catch (error) {
    return apiError(error, `POST /api/admin/competitions/${params.id}/clubs`);
  }
}
