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
import DisciplinaryRuleSet from '@/lib/models/DisciplinaryRuleSet';
import MatchOfficialAssignment from '@/lib/models/MatchOfficialAssignment';
import '@/lib/models/Arbitre';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { session, clubId } = await requireClub();
    const organizationId = session.user.organizationId;
    await connectDB();

    const [
      totalJoueurs,
      prochainsMatchs,
      suspensionsActives,
      cardsThisSeason,
    ] = await Promise.all([
      Joueur.countDocuments({ organizationId, clubId, status: 'ACTIVE' }),
      Match.find({
        organizationId,
        $or: [{ homeClubId: clubId }, { awayClubId: clubId }],
        date: { $gte: new Date() },
        statut: 'Programmé',
      })
        .populate('homeClubId awayClubId competitionId', 'nom logo nom')
        .populate('arbitrePrincipalId assistants', 'displayName nom prenom categorie')
        .sort({ date: 1 })
        .limit(5)
        .lean(),
      Suspension.find({
        organizationId,
        clubId,
        status: { $in: ['ACTIVE', 'PROVISIONAL'] },
      }).populate('joueurId', 'nom prenom').limit(10).lean(),
      DisciplinaryCard.countDocuments({ organizationId, clubId }),
    ]);

    const competitions = await Competition.find({
      organizationId,
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
      organizationId,
      recipientClubId: clubId,
      read: false,
    });

    const matchWithOfficials = await Promise.all(
      prochainsMatchs.map(async (m: any) => {
        let publishedOfficials = null;
        const assignment = await MatchOfficialAssignment.findOne({
          matchId: m._id,
          organizationId,
          status: 'PUBLISHED',
        })
          .populate('referees.refereeId')
          .lean();

        if (assignment) {
          publishedOfficials = {
            publishedAt: assignment.publishedAt,
            referees: assignment.referees.map((r: any) => {
              const ref = r.refereeId;
              return {
                displayName: ref ? (ref.displayName || `${ref.prenom} ${ref.nom}`) : 'N/A',
                role: r.role,
                categorie: r.role === 'MAIN' ? ref?.categorie : undefined,
              };
            }),
          };
        } else if (m.homologue && m.arbitrePrincipalId) {
          publishedOfficials = {
            publishedAt: m.updatedAt,
            referees: [
              {
                displayName: m.arbitrePrincipalId.displayName || `${m.arbitrePrincipalId.prenom} ${m.arbitrePrincipalId.nom}`,
                role: 'MAIN',
                categorie: m.arbitrePrincipalId.categorie,
              },
              ...(m.assistants || []).map((ast: any, idx: number) => ({
                displayName: ast.displayName || `${ast.prenom} ${ast.nom}`,
                role: idx === 0 ? 'ASSISTANT_1' : 'ASSISTANT_2',
              })),
            ],
          };
        }

        const copy = { ...m };
        delete copy.arbitrePrincipalId;
        delete copy.assistants;
        return {
          ...copy,
          publishedOfficials,
        };
      })
    );

    const nextMatch = prochainsMatchs[0];
    const nextCompetitionId = nextMatch?.competitionId?._id ?? nextMatch?.competitionId;
    const nextSeasonId = nextMatch?.saisonId?._id ?? nextMatch?.saisonId;
    const ruleSet = nextMatch && nextSeasonId
      ? await DisciplinaryRuleSet.findOne({
          organizationId,
          seasonId: nextSeasonId,
          active: true,
          effectiveFrom: { $lte: nextMatch.date },
          $and: [
            { $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: nextMatch.date } }] },
            { $or: [{ competitionId: nextCompetitionId }, { competitionId: { $exists: false } }, { competitionId: null }] },
          ],
        })
          .sort({ competitionId: -1, version: -1 })
          .select('yellowCardThreshold')
          .lean()
      : null;
    const atRiskThreshold = Math.max(1, (ruleSet?.yellowCardThreshold ?? 3) - 1);
    const atRiskCount = nextMatch && nextSeasonId
      ? await DisciplinaryCard.aggregate([
          { $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            clubId: new mongoose.Types.ObjectId(clubId),
            saisonId: new mongoose.Types.ObjectId(nextSeasonId.toString()),
            cardType: 'YELLOW',
            accumulationStatus: 'ACTIVE',
          } },
          { $group: { _id: '$joueurId', count: { $sum: 1 } } },
          { $match: { count: { $gte: atRiskThreshold } } },
          { $count: 'total' },
        ]).then((rows) => rows[0]?.total || 0)
      : 0;

    return NextResponse.json({
      totalJoueurs,
      prochainsMatchs: matchWithOfficials,
      suspensionsActives,
      cardsThisSeason,
      monClassement,
      unreadNotifs,
      nextMatchSummary: nextMatch ? {
        matchId: nextMatch._id,
        suspendedCount: suspensionsActives.length,
        atRiskCount,
      } : null,
    });
  } catch (error) {
    return apiError(error, 'GET /api/club/dashboard');
  }
}
