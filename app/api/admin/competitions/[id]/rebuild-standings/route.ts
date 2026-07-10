import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import StandingsService from '@/lib/services/standings.service';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();

    const standings = await StandingsService.rebuildCompetitionStandings(
      (await params).id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      matchesProcessed: standings.matchesProcessed,
      calculatedAt: standings.calculatedAt,
    });
  } catch (error) {
    return apiError(error, `POST /api/admin/competitions/${(await params).id}/rebuild-standings`);
  }
}
