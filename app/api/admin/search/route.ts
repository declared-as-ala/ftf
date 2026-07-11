import { NextResponse } from 'next/server';
import { requireAdmin, apiError, escapeRegex } from '@/lib/api';
import connectDB from '@/lib/db';
import Joueur from '@/lib/models/Joueur';
import Club from '@/lib/models/Club';
import Match from '@/lib/models/Match';
import Competition from '@/lib/models/Competition';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const regex = { $regex: escapeRegex(q), $options: 'i' };

    const [joueurs, clubs, matches, competitions] = await Promise.all([
      Joueur.find({
        $or: [{ nom: regex }, { prenom: regex }, { licence: regex }],
      })
        .populate('clubId', 'nom')
        .limit(10)
        .lean(),

      Club.find({
        $or: [{ nom: regex }, { code: regex }],
      })
        .limit(10)
        .lean(),

      Match.find({
        $or: [
          { stade: regex },
          { 'feuilleMatchElectronique.homeComposition': { $exists: true } },
        ],
      })
        .populate('homeClubId awayClubId', 'nom')
        .limit(10)
        .lean(),

      Competition.find({
        $or: [{ nom: regex }, { code: regex }],
      })
        .limit(10)
        .lean(),
    ]);

    return NextResponse.json({
      results: {
        joueurs: joueurs.map((j: any) => ({
          _id: j._id,
          type: 'joueur',
          label: `${j.prenom} ${j.nom} (${j.licence})`,
          href: `/admin/joueurs?id=${j._id}`,
          club: j.clubId?.nom,
        })),
        clubs: clubs.map((c: any) => ({
          _id: c._id,
          type: 'club',
          label: c.nom,
          href: `/admin/clubs/${c._id}`,
        })),
        matches: matches.map((m: any) => ({
          _id: m._id,
          type: 'match',
          label: `${(m as any).homeClubId?.nom} vs ${(m as any).awayClubId?.nom}`,
          href: `/admin/matchs/${m._id}`,
        })),
        competitions: competitions.map((c: any) => ({
          _id: c._id,
          type: 'competition',
          label: c.nom,
          href: `/admin/competitions/${c._id}`,
        })),
      },
    });
  } catch (error) {
    return apiError(error, 'GET /api/admin/search');
  }
}
