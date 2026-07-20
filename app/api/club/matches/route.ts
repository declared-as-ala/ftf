import { NextResponse } from 'next/server';
import { requireClub, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import MatchOfficialAssignment from '@/lib/models/MatchOfficialAssignment';
import '@/lib/models/Arbitre';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { session, clubId } = await requireClub();
    const organizationId = session.user.organizationId;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get('statut');
    const competitionId = searchParams.get('competitionId');
    const { skip, limit } = parsePagination(searchParams);

    const query: any = {
      organizationId,
      $or: [{ homeClubId: clubId }, { awayClubId: clubId }],
    };
    if (statut) query.statut = statut;
    if (competitionId) query.competitionId = competitionId;

    const matches = await Match.find(query)
      .populate('homeClubId awayClubId competitionId saisonId', 'nom logo nom nom')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Match.countDocuments(query);

    const matchIds = matches.map((m: any) => m._id);
    const assignments = await MatchOfficialAssignment.find({
      matchId: { $in: matchIds },
      organizationId,
      status: 'PUBLISHED',
    })
      .populate('referees.refereeId', 'displayName nom prenom categorie')
      .lean();

    const assignmentByMatch: Record<string, any> = {};
    for (const a of assignments) {
      assignmentByMatch[a.matchId.toString()] = a;
    }

    const enriched = matches.map((m: any) => {
      const a = assignmentByMatch[m._id.toString()];
      let publishedOfficials = null;
      if (a) {
        publishedOfficials = {
          publishedAt: a.publishedAt,
          referees: a.referees.map((r: any) => {
            const ref = r.refereeId as any;
            return {
              displayName: ref ? (ref.displayName || `${ref.prenom} ${ref.nom}`) : 'N/A',
              role: r.role,
              categorie: r.role === 'MAIN' ? ref?.categorie : undefined,
            };
          }),
        };
      }
      return { ...m, publishedOfficials };
    });

    return NextResponse.json({ matches: enriched, total });
  } catch (error) {
    return apiError(error, 'GET /api/club/matches');
  }
}
