import { NextResponse } from 'next/server';
import { requireClub, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Joueur from '@/lib/models/Joueur';
import Match from '@/lib/models/Match';
import DisciplinaryCard from '@/lib/models/DisciplinaryCard';
import Suspension from '@/lib/models/Suspension';
import Competition from '@/lib/models/Competition';
import Standings from '@/lib/models/Standings';
import Notification from '@/lib/models/Notification';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const [
      totalJoueurs,
      prochainsMatchs,
      suspensionsActives,
      cardsThisSeason,
    ] = await Promise.all([
      Joueur.countDocuments({ clubId, status: 'ACTIVE' }),
      Match.find({
        $or: [{ homeClubId: clubId }, { awayClubId: clubId }],
        date: { $gte: new Date() },
        statut: 'Programmé',
      })
        .populate('homeClubId awayClubId competitionId', 'nom logo nom')
        .sort({ date: 1 })
        .limit(5)
        .lean(),
      Suspension.find({
        clubId,
        status: { $in: ['ACTIVE', 'PROVISIONAL'] },
      }).populate('joueurId', 'nom prenom').limit(10).lean(),
      DisciplinaryCard.countDocuments({ clubId }),
    ]);

    const competitions = await Competition.find({
      clubsParticipants: clubId,
      status: { $in: ['ACTIVE', 'SCHEDULED'] },
    }).select('_id nom').lean();

    let monClassement: any = null;
    if (competitions.length > 0) {
      const compId = competitions[0]._id;
      const standings = await Standings.findOne({ competitionId: compId })
        .populate('rows.clubId', 'nom logo')
        .lean();
      if (standings) {
        monClassement = {
          competition: competitions[0],
          classement: standings.rows
            .sort((a: any, b: any) => a.position - b.position)
            .slice(0, 10),
        };
      }
    }

    const unreadNotifs = await Notification.countDocuments({
      recipientClubId: clubId,
      read: false,
    });

    return NextResponse.json({
      totalJoueurs,
      prochainsMatchs,
      suspensionsActives,
      cardsThisSeason,
      monClassement,
      unreadNotifs,
    });
  } catch (error) {
    return apiError(error, 'GET /api/club/dashboard');
  }
}
