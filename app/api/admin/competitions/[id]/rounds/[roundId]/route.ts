import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Round from '@/lib/models/Round';
import Match from '@/lib/models/Match';
import '@/lib/models/Club';
import '@/lib/models/Joueur';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string; roundId: string } }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;

    await connectDB();

    const round = await Round.findOne({
      _id: params.roundId,
      competitionId: params.id,
      organizationId: orgId,
    }).lean();

    if (!round) {
      return NextResponse.json({ error: 'Journée introuvable' }, { status: 404 });
    }

    const matches = await Match.find({ roundId: params.roundId, competitionId: params.id })
      .populate('homeClubId', 'nom logo code')
      .populate('awayClubId', 'nom logo code')
      .populate('evenements.joueurId', 'nom prenom')
      .sort({ date: 1 })
      .lean();

    return NextResponse.json({ round, matches });
  } catch (error) {
    return apiError(error, `GET /api/admin/competitions/${params.id}/rounds/${params.roundId}`);
  }
}
