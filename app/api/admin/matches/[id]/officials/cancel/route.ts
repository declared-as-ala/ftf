import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import RefereeAssignmentService from '@/lib/services/referee-assignment.service';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) throw new ApiError(400, 'Organisation non configurée');

    await connectDB();

    const { id: matchId } = await params;
    const body = await req.json();

    const version = parseInt(body.version);
    if (isNaN(version)) {
      throw new ApiError(400, 'Le numéro de version est requis et doit être un entier');
    }

    const cancelled = await RefereeAssignmentService.cancel({
      matchId,
      version,
      reason: body.reason,
      actorId: session.user.id,
      organizationId: orgId.toString(),
    });

    return NextResponse.json(cancelled);
  } catch (error) {
    return apiError(error, 'POST /api/admin/matches/[id]/officials/cancel');
  }
}
