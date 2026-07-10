import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';
import Saison from '@/lib/models/Saison';
import DisciplinaryRuleSet from '@/lib/models/DisciplinaryRuleSet';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await requireAdmin();
    await connectDB();

    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    const [org, currentSeason, ruleSets] = await Promise.all([
      Organization.findById(orgId).lean(),
      Saison.findOne({ organizationId: orgId, isCurrent: true }).lean(),
      DisciplinaryRuleSet.find({ organizationId: orgId }).lean(),
    ]);

    return NextResponse.json({ org, currentSeason, ruleSets });
  } catch (error) {
    return apiError(error, 'GET /api/admin/settings');
  }
}
