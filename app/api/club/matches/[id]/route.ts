import { NextResponse } from 'next/server';
import { requireClub, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import Suspension from '@/lib/models/Suspension';
import DisciplinaryCard from '@/lib/models/DisciplinaryCard';
import DisciplinaryRuleSet from '@/lib/models/DisciplinaryRuleSet';
import '@/lib/models/Joueur';
import '@/lib/models/Club';
import '@/lib/models/Competition';
import '@/lib/models/Saison';
import '@/lib/models/Arbitre';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { id } = await params;

    const match = await Match.findById(id)
      .populate('homeClubId', 'nom logo code')
      .populate('awayClubId', 'nom logo code')
      .populate('competitionId', 'nom')
      .populate('saisonId', 'nom')
      .populate('arbitrePrincipalId', 'nom prenom')
      .populate('evenements.joueurId', 'nom prenom numeroMaillot clubId photo')
      .lean();

    if (!match) {
      throw new ApiError(404, 'Match introuvable');
    }

    const isParticipant =
      match.homeClubId?._id?.toString() === clubId ||
      match.awayClubId?._id?.toString() === clubId;
    if (!isParticipant) {
      throw new ApiError(403, 'Accès refusé');
    }

    const goals = (match.evenements || []).filter((ev: any) => ev.type === 'But' && ev.equipe);
    match.scoreHome = goals.filter((ev: any) => ev.equipe === 'home').length;
    match.scoreAway = goals.filter((ev: any) => ev.equipe === 'away').length;

    // ── Indisponibilités du club authentifié (responsabilité du club — §6.8) ──
    // Seules les données du club de la session sont exposées, jamais celles
    // de l'adversaire.
    const [activeSuspensions, activeYellowCards, ruleSet] = await Promise.all([
      Suspension.find({
        clubId,
        status: { $in: ['ACTIVE', 'PROVISIONAL'] },
      })
        .populate('joueurId', 'nom prenom numeroMaillot photo position')
        .lean(),
      DisciplinaryCard.find({
        clubId,
        cardType: 'YELLOW',
        accumulationStatus: 'ACTIVE',
      })
        .select('joueurId')
        .lean(),
      DisciplinaryRuleSet.findOne({ active: true }).sort({ version: -1 }).lean(),
    ]);

    const threshold = ruleSet?.yellowCardThreshold ?? 3;

    const yellowsByPlayer: Record<string, number> = {};
    for (const c of activeYellowCards) {
      const key = c.joueurId.toString();
      yellowsByPlayer[key] = (yellowsByPlayer[key] || 0) + 1;
    }

    const suspendedIds = new Set(
      activeSuspensions.map((s: any) => s.joueurId?._id?.toString()).filter(Boolean)
    );

    const unavailable = activeSuspensions
      .filter((s: any) => s.joueurId)
      .map((s: any) => ({
        joueur: s.joueurId,
        status: s.status,
        suspensionType: s.suspensionType,
        matchesRemaining: s.matchesRemaining,
        reason:
          s.status === 'PROVISIONAL'
            ? 'Décision disciplinaire en attente'
            : s.suspensionType === 'YELLOW_ACCUMULATION'
              ? 'Accumulation de cartons jaunes'
              : 'Suspension disciplinaire',
      }));

    // Joueurs "à risque" : un jaune de plus = suspension (non suspendus)
    const atRiskIds = Object.entries(yellowsByPlayer)
      .filter(([pid, n]) => n >= threshold - 1 && !suspendedIds.has(pid))
      .map(([pid]) => pid);

    const atRisk =
      atRiskIds.length > 0
        ? (
            await import('@/lib/models/Joueur').then((m) =>
              m.default
                .find({ _id: { $in: atRiskIds } })
                .select('nom prenom numeroMaillot photo position')
                .lean()
            )
          ).map((j: any) => ({
            joueur: j,
            activeYellows: yellowsByPlayer[j._id.toString()],
            threshold,
          }))
        : [];

    return NextResponse.json({
      ...match,
      clubEligibility: { clubId, unavailable, atRisk, threshold },
    });
  } catch (error) {
    return apiError(error, 'GET /api/club/matches/[id]');
  }
}
