import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Standings from '@/lib/models/Standings';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;

    await connectDB();

    const standings = await Standings.findOne({ competitionId: params.id })
      .populate('rows.clubId', 'nom logo code')
      .lean();

    if (!standings) {
      return NextResponse.json({ rows: [], calculatedAt: null, matchesProcessed: 0 });
    }

    return NextResponse.json(standings);
  } catch (error) {
    return apiError(error, `GET /api/admin/competitions/${params.id}/standings`);
  }
}
