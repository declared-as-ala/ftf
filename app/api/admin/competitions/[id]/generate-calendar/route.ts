import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import ScheduleGenerationService from '@/lib/services/schedule-generation.service';

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

    const { id: competitionId } = params;
    const body = await req.json().catch(() => ({}));
    const { doubleLeg = true, startDate } = body;

    const parsedStartDate = startDate ? new Date(startDate) : new Date();

    const result = await ScheduleGenerationService.generateCalendar({
      competitionId,
      organizationId: orgId,
      actorId: session.user.id,
      doubleLeg: !!doubleLeg,
      startDate: parsedStartDate,
    });

    return NextResponse.json({
      success: true,
      roundsCount: result.roundsCount,
      matchesCount: result.matchesCount,
    });
  } catch (error) {
    return apiError(error, `POST /api/admin/competitions/${params.id}/generate-calendar`);
  }
}
