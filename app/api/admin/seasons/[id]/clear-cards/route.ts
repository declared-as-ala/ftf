import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api';
import connectDB from '@/lib/db';
import { YellowCardAccumulationService } from '@/lib/services/yellow-card-accumulation.service';
import AuditService from '@/lib/services/audit.service';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId!;
    const { id } = await params;
    await connectDB();

    const cleared = await YellowCardAccumulationService.clearSeasonYellows(id, session.user.id!, orgId);

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'SEASON_YELLOW_CARDS_CLEARED',
      entityType: 'Saison',
      entityId: id,
      after: { count: cleared },
      reason: 'Effacement de fin de saison des cartons jaunes actifs',
      organizationId: orgId,
    });

    return NextResponse.json({ cleared });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 });
  }
}
