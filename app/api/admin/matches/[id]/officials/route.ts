import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import MatchOfficialAssignment from '@/lib/models/MatchOfficialAssignment';
import RefereeAssignmentService from '@/lib/services/referee-assignment.service';
import Match from '@/lib/models/Match';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) throw new ApiError(400, 'Organisation non configurée');

    await connectDB();

    const { id: matchId } = await params;

    // Verify match belongs to organization
    const match = await Match.findOne({ _id: matchId, organizationId: orgId });
    if (!match) {
      throw new ApiError(404, 'Match introuvable');
    }

    const assignments = await MatchOfficialAssignment.find({
      matchId,
      organizationId: orgId,
    })
      .sort({ version: -1 })
      .populate('referees.refereeId')
      .populate('publishedBy', 'nom prenom')
      .populate('cancelledBy', 'nom prenom')
      .lean();

    return NextResponse.json(assignments);
  } catch (error) {
    return apiError(error, 'GET /api/admin/matches/[id]/officials');
  }
}

export async function PUT(
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

    const referees = body.referees;
    if (!Array.isArray(referees)) {
      throw new ApiError(400, 'Format de referees invalide. Doit être un tableau');
    }

    const draft = await RefereeAssignmentService.saveDraft({
      matchId,
      referees,
      notes: body.notes,
      actorId: session.user.id,
      organizationId: orgId.toString(),
    });

    return NextResponse.json(draft);
  } catch (error) {
    return apiError(error, 'PUT /api/admin/matches/[id]/officials');
  }
}
