import { NextResponse } from 'next/server';
import { requireClub, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Standings from '@/lib/models/Standings';
import Competition from '@/lib/models/Competition';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get('competitionId');

    let compIds: string[] = [];
    if (competitionId) {
      compIds = [competitionId];
    } else {
      const comps = await Competition.find({
        clubsParticipants: clubId,
        status: { $in: ['ACTIVE', 'COMPLETED', 'SCHEDULED'] },
      }).select('_id nom type').sort({ dateDebut: -1 }).lean();
      compIds = comps.map((c) => c._id.toString());
    }

    if (compIds.length === 0) {
      return NextResponse.json({ standings: [] });
    }

    const standings = await Standings.find({ competitionId: { $in: compIds } })
      .populate('rows.clubId', 'nom logo')
      .populate('competitionId', 'nom type')
      .sort({ calculatedAt: -1 })
      .lean();

    return NextResponse.json({ standings });
  } catch (error) {
    return apiError(error, 'GET /api/club/standings');
  }
}
