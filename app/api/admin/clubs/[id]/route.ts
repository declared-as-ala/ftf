import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import Club from '@/lib/models/Club';
import Match from '@/lib/models/Match';
import Joueur from '@/lib/models/Joueur';
import Staff from '@/lib/models/Staff';
import Competition from '@/lib/models/Competition';
import Saison from '@/lib/models/Saison';
import Arbitre from '@/lib/models/Arbitre';

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

    // Ensure models are registered (imports at top should handle this, but this ensures execution)
    // Reference the models to ensure they're loaded
    if (!mongoose.models.Competition || !mongoose.models.Saison || !mongoose.models.Arbitre) {
      // Force model registration by accessing them
      Competition.modelName;
      Saison.modelName;
      Arbitre.modelName;
    }

    const id = await unwrapIdParam(context);

    // Fetch club
    const club = await Club.findById(id).lean();
    if (!club) {
      return NextResponse.json({ error: 'Club introuvable' }, { status: 404 });
    }

    // Fetch players
    const players = await Joueur.find({ clubId: id })
      .sort({ numeroMaillot: 1 })
      .lean();

    // Fetch staff
    const staff = await Staff.find({ clubId: id })
      .sort({ type: 1 })
      .lean();

    // Fetch matches (home and away)
    const matches = await Match.find({
      $or: [{ homeClubId: id }, { awayClubId: id }],
    })
      .populate('homeClubId', 'nom logo')
      .populate('awayClubId', 'nom logo')
      .populate('competitionId', 'nom')
      .populate('saisonId', 'nom')
      .populate('arbitrePrincipalId', 'nom prenom')
      .populate('evenements.joueurId', 'nom prenom numeroMaillot')
      .sort({ date: -1 })
      .lean();

    // Separate fixtures and results
    const fixtures = matches.filter((m) => m.statut === 'Programmé' || m.statut === 'En Cours');
    const results = matches.filter((m) => m.statut === 'Terminé');

    return NextResponse.json({
      club,
      players,
      staff,
      fixtures,
      results,
    });
  } catch (error: any) {
    console.error('GET /api/admin/clubs/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


