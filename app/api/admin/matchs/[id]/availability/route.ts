import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import DisciplineService from '@/lib/services/discipline.service';

export const runtime = 'nodejs';

type ParamsPromise = { params: Promise<{ id: string }> } | { params: { id: string } };

function unwrapIdParam(context: ParamsPromise): Promise<string> {
  const maybePromise = (context as any).params;
  if (typeof maybePromise.then === 'function') {
    return (maybePromise as Promise<{ id: string }>).then((p) => p.id);
  }
  return Promise.resolve((maybePromise as { id: string }).id);
}

export async function GET(_req: Request, context: ParamsPromise) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'FTF_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const matchId = await unwrapIdParam(context);
    const match = await Match.findById(matchId).lean();

    if (!match) {
      return NextResponse.json({ error: 'Match introuvable' }, { status: 404 });
    }

    // Only show availability for upcoming matches
    if (match.statut === 'Terminé') {
      return NextResponse.json({ error: 'Disponibilité uniquement pour les matchs à venir' }, { status: 400 });
    }

    const availability = await DisciplineService.getPlayerAvailabilityForMatch(
      matchId,
      match.homeClubId.toString(),
      match.awayClubId.toString(),
      match.saisonId.toString()
    );

    return NextResponse.json(availability);
  } catch (error: any) {
    console.error('GET /api/admin/matchs/[id]/availability error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}



