import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Round from '@/lib/models/Round';
import Match from '@/lib/models/Match';
import MatchOfficialAssignment from '@/lib/models/MatchOfficialAssignment';
import '@/lib/models/Club';
import '@/lib/models/Joueur';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;

    await connectDB();

    const round = await Round.findOne({
      _id: (await params).roundId,
      competitionId: (await params).id,
      organizationId: orgId,
    }).lean();

    if (!round) {
      return NextResponse.json({ error: 'Journée introuvable' }, { status: 404 });
    }

    const matches = await Match.find({ roundId: (await params).roundId, competitionId: (await params).id })
      .populate('homeClubId', 'nom logo code')
      .populate('awayClubId', 'nom logo code')
      .populate('evenements.joueurId', 'nom prenom')
      .sort({ date: 1 })
      .lean();

    const matchIds = matches.map(m => m._id);
    const assignments = await MatchOfficialAssignment.find({
      matchId: { $in: matchIds },
      organizationId: orgId,
    })
      .sort({ version: -1 })
      .populate('referees.refereeId')
      .lean();

    const latestAssignments: Record<string, any> = {};
    for (const ass of assignments) {
      const mId = ass.matchId.toString();
      if (!latestAssignments[mId]) {
        latestAssignments[mId] = ass;
      }
    }

    return NextResponse.json({ round, matches, latestAssignments });
  } catch (error) {
    return apiError(error, `GET /api/admin/competitions/${(await params).id}/rounds/${(await params).roundId}`);
  }
}
