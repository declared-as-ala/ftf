import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import Competition from '@/lib/models/Competition';
import Club from '@/lib/models/Club';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'FTF_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get('competitionId');

    if (!competitionId) {
      return NextResponse.json({ error: 'competitionId requis' }, { status: 400 });
    }

    const competition = await Competition.findById(competitionId).lean();
    if (!competition) {
      return NextResponse.json({ error: 'Compétition introuvable' }, { status: 404 });
    }

    const matches = await Match.find({
      competitionId,
      statut: 'Terminé',
    })
      .select('homeClubId awayClubId scoreHome scoreAway')
      .lean();

    const clubsMap: Record<
      string,
      {
        clubId: string;
        nom: string;
        logo?: string;
        matchesJoues: number;
        victoires: number;
        nuls: number;
        defaites: number;
        butsMarques: number;
        butsEncaisses: number;
        difference: number;
        points: number;
      }
    > = {};

    const pointWin = competition.reglementPoints?.victoire ?? 3;
    const pointDraw = competition.reglementPoints?.nul ?? 1;
    const pointLoss = competition.reglementPoints?.defaite ?? 0;

    for (const match of matches) {
      const homeId = String(match.homeClubId);
      const awayId = String(match.awayClubId);

      if (!clubsMap[homeId]) {
        clubsMap[homeId] = {
          clubId: homeId,
          nom: '',
          logo: undefined,
          matchesJoues: 0,
          victoires: 0,
          nuls: 0,
          defaites: 0,
          butsMarques: 0,
          butsEncaisses: 0,
          difference: 0,
          points: 0,
        };
      }

      if (!clubsMap[awayId]) {
        clubsMap[awayId] = {
          clubId: awayId,
          nom: '',
          logo: undefined,
          matchesJoues: 0,
          victoires: 0,
          nuls: 0,
          defaites: 0,
          butsMarques: 0,
          butsEncaisses: 0,
          difference: 0,
          points: 0,
        };
      }

      const home = clubsMap[homeId];
      const away = clubsMap[awayId];

      home.matchesJoues += 1;
      away.matchesJoues += 1;

      home.butsMarques += match.scoreHome;
      home.butsEncaisses += match.scoreAway;
      away.butsMarques += match.scoreAway;
      away.butsEncaisses += match.scoreHome;

      if (match.scoreHome > match.scoreAway) {
        home.victoires += 1;
        home.points += pointWin;
        away.defaites += 1;
        away.points += pointLoss;
      } else if (match.scoreHome < match.scoreAway) {
        away.victoires += 1;
        away.points += pointWin;
        home.defaites += 1;
        home.points += pointLoss;
      } else {
        home.nuls += 1;
        away.nuls += 1;
        home.points += pointDraw;
        away.points += pointDraw;
      }
    }

    const clubIds = Object.keys(clubsMap);
    const clubs = await Club.find({ _id: { $in: clubIds } })
      .select('nom logo')
      .lean();

    for (const club of clubs) {
      const entry = clubsMap[String(club._id)];
      if (entry) {
        entry.nom = club.nom;
        entry.logo = (club as any).logo;
        entry.difference = entry.butsMarques - entry.butsEncaisses;
      }
    }

    const standings = Object.values(clubsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.difference !== a.difference) return b.difference - a.difference;
      return b.butsMarques - a.butsMarques;
    });

    return NextResponse.json(standings);
  } catch (error: any) {
    console.error('GET /api/admin/standings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}






