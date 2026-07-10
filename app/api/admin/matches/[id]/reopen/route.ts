import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import MatchCorrectionService from '@/lib/services/match-correction.service';
import { z } from 'zod';

export const runtime = 'nodejs';

const reopenSchema = z.object({
  reason: z.string().min(5, 'La raison doit comporter au moins 5 caractères'),
});

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

    const body = await req.json();
    const { reason } = reopenSchema.parse(body);

    const match = await MatchCorrectionService.reopenMatch(
      params.id,
      reason,
      session.user.id,
      orgId
    );

    return NextResponse.json(match);
  } catch (error) {
    return apiError(error, `POST /api/admin/matches/${params.id}/reopen`);
  }
}
