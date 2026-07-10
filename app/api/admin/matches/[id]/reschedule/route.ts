import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import MatchFinalizationService from '@/lib/services/match-finalization.service';
import { z } from 'zod';

export const runtime = 'nodejs';

const rescheduleSchema = z.object({
  newDate: z.string().min(1),
  reason: z.string().min(5, 'La raison doit comporter au moins 5 caractères'),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    const body = await req.json();
    const { newDate, reason } = rescheduleSchema.parse(body);

    const match = await MatchFinalizationService.rescheduleMatch(
      (await params).id,
      new Date(newDate),
      reason,
      session.user.id,
      orgId
    );

    return NextResponse.json(match);
  } catch (error) {
    return apiError(error, `POST /api/admin/matches/${(await params).id}/reschedule`);
  }
}
