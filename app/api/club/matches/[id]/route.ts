import { NextResponse } from 'next/server';
import { requireClub, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import MatchEvent from '@/lib/models/MatchEvent';
import Suspension from '@/lib/models/Suspension';
import DisciplinaryCard from '@/lib/models/DisciplinaryCard';
import DisciplinaryRuleSet from '@/lib/models/DisciplinaryRuleSet';
import MatchOfficialAssignment from '@/lib/models/MatchOfficialAssignment';
import Joueur from '@/lib/models/Joueur';
import '@/lib/models/Club'; import '@/lib/models/Competition'; import '@/lib/models/Saison'; import '@/lib/models/Arbitre';

export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, clubId } = await requireClub();
    const organizationId = session.user.organizationId;
    if (!organizationId) throw new ApiError(400, 'Organisation non configurée');
    await connectDB();
    const { id } = await params;
    const match = await Match.findOne({ _id: id, organizationId, $or: [{ homeClubId: clubId }, { awayClubId: clubId }] })
      .select('competitionId saisonId roundId journee homeClubId awayClubId date stade venueCity scoreHome scoreAway statut isOfficial homologue public arbitrePrincipalId assistants spectateurs')
      .populate('homeClubId', 'nom logo code').populate('awayClubId', 'nom logo code')
      .populate('competitionId', 'nom code').populate('saisonId', 'nom code')
      .populate('arbitrePrincipalId', 'nom prenom categorie').populate('assistants', 'nom prenom categorie').lean();
    if (!match) throw new ApiError(404, 'Match introuvable');

    const [events, activeSuspensions, activeYellowCards, ruleSet] = await Promise.all([
      MatchEvent.find({ organizationId, matchId: id, status: 'CONFIRMED' }).select('clubId playerId type minute stoppageMinute assistPlayerId cardReason').populate('clubId', 'nom code logo').populate('playerId', 'nom prenom numeroMaillot clubId').populate('assistPlayerId', 'nom prenom numeroMaillot').sort({ minute: 1 }).lean(),
      Suspension.find({ organizationId, clubId, status: { $in: ['ACTIVE', 'PROVISIONAL'] } }).populate('joueurId', 'nom prenom numeroMaillot photo position').lean(),
      DisciplinaryCard.find({ organizationId, clubId, saisonId: match.saisonId, cardType: 'YELLOW', accumulationStatus: 'ACTIVE' }).select('joueurId').lean(),
      DisciplinaryRuleSet.findOne({ organizationId, seasonId: match.saisonId, $or: [{ competitionId: match.competitionId }, { competitionId: { $exists: false } }], active: true }).sort({ competitionId: -1, version: -1 }).lean(),
    ]);
    const threshold = ruleSet?.yellowCardThreshold ?? 3;
    const yellowsByPlayer: Record<string, number> = {};
    activeYellowCards.forEach((card) => { const key = card.joueurId.toString(); yellowsByPlayer[key] = (yellowsByPlayer[key] || 0) + 1; });
    const suspendedIds = new Set(activeSuspensions.map((item:any) => item.joueurId?._id?.toString()).filter(Boolean));
    const atRiskIds = Object.entries(yellowsByPlayer).filter(([pid,n]) => n >= threshold - 1 && !suspendedIds.has(pid)).map(([pid]) => pid);
    const atRiskPlayers = await Joueur.find({ _id: { $in: atRiskIds }, organizationId, clubId }).select('nom prenom numeroMaillot photo position').lean();

    // Fetch published officials from versioned MatchOfficialAssignment
    let publishedOfficials = null;
    const assignment = await MatchOfficialAssignment.findOne({
      matchId: id,
      organizationId,
      status: 'PUBLISHED',
    })
      .populate('referees.refereeId')
      .lean();

    if (assignment) {
      publishedOfficials = {
        publishedAt: assignment.publishedAt,
        referees: assignment.referees.map((r: any) => {
          const ref = r.refereeId as any;
          return {
            displayName: ref ? (ref.displayName || `${ref.prenom} ${ref.nom}`) : 'N/A',
            role: r.role,
            categorie: r.role === 'MAIN' ? ref?.categorie : undefined,
          };
        }),
      };
    } else {
      // Fallback to legacy Match.arbitrePrincipalId (read-only compat)
      const officialsVisible = Boolean(match.public || match.homologue);
      if (officialsVisible && match.arbitrePrincipalId) {
        publishedOfficials = {
          publishedAt: null,
          referees: [
            {
              displayName: (match.arbitrePrincipalId as any).displayName || `${(match.arbitrePrincipalId as any).prenom} ${(match.arbitrePrincipalId as any).nom}`,
              role: 'MAIN',
              categorie: (match.arbitrePrincipalId as any).categorie,
            },
            ...(match.assistants || []).map((ast: any, idx: number) => ({
              displayName: ast.displayName || `${ast.prenom} ${ast.nom}`,
              role: idx === 0 ? 'ASSISTANT_1' : 'ASSISTANT_2',
            })),
          ],
        };
      }
    }

    return NextResponse.json({
      _id: match._id, competitionId: match.competitionId, saisonId: match.saisonId, journee: match.journee,
      homeClubId: match.homeClubId, awayClubId: match.awayClubId, date: match.date, stade: match.stade,
      venueCity: match.venueCity, scoreHome: match.scoreHome, scoreAway: match.scoreAway, statut: match.statut,
      isOfficial: match.isOfficial, homologue: match.homologue, spectateurs: match.spectateurs,
      publishedOfficials,
      events,
      evenements: events.map((event:any) => ({ _id: event._id, type: event.type, minute: event.minute, stoppageMinute: event.stoppageMinute, joueurId: event.playerId, clubId: event.clubId, cardReason: event.cardReason })),
      clubEligibility: {
        clubId, threshold,
        unavailable: activeSuspensions.filter((item:any) => item.joueurId).map((item:any) => ({ joueur: item.joueurId, status: item.status, suspensionType: item.suspensionType, matchesRemaining: item.matchesRemaining, reason: item.status === 'PROVISIONAL' ? 'Décision disciplinaire en attente' : item.suspensionType === 'YELLOW_ACCUMULATION' ? 'Accumulation de cartons jaunes' : 'Suspension disciplinaire' })),
        atRisk: atRiskPlayers.map((joueur:any) => ({ joueur, activeYellows: yellowsByPlayer[joueur._id.toString()], threshold })),
      },
    });
  } catch (error) { return apiError(error, 'GET /api/club/matches/[id]'); }
}
