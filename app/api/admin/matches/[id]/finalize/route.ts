import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import MatchFinalizationService from '@/lib/services/match-finalization.service';

export const runtime = 'nodejs';

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

    const result = await MatchFinalizationService.finalizeMatch(
      (await params).id,
      session.user.id,
      orgId
    );

    if (result.status === 'error') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    return apiError(error, `POST /api/admin/matches/${(await params).id}/finalize`);
  }
}
