import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Arbitre from '@/lib/models/Arbitre';

export const runtime = 'nodejs';

/**
 * GET /api/admin/arbitres
 * Legacy compatibility endpoint that returns all active/non-archived referees for the organization.
 */
export async function GET() {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    
    await connectDB();

    const referees = await Arbitre.find({
      organizationId: orgId,
      status: { $ne: 'ARCHIVED' }
    }).sort({ nom: 1, prenom: 1 }).lean();

    return NextResponse.json(referees);
  } catch (error) {
    return apiError(error, 'GET /api/admin/arbitres');
  }
}
