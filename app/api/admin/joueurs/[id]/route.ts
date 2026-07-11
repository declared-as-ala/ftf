import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import PlayerStatsService from '@/lib/services/player-stats.service';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;

    const stats = await PlayerStatsService.getFullStats(id);
    if (!stats) {
      throw new ApiError(404, 'Joueur introuvable');
    }

    return NextResponse.json(stats);
  } catch (error) {
    return apiError(error, 'GET /api/admin/joueurs/[id]');
  }
}
