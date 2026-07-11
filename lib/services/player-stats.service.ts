import mongoose from 'mongoose';
import Joueur from '../models/Joueur';
import Match from '../models/Match';
import DisciplinaryCard from '../models/DisciplinaryCard';
import Suspension from '../models/Suspension';
import SuspensionServiceEntry from '../models/SuspensionServiceEntry';
import DisciplinaryRuleSet from '../models/DisciplinaryRuleSet';
import '../models/Club';

export interface PlayerGoalEntry {
  matchId: string;
  date: Date;
  journee?: number;
  minute?: number;
  homeAway: 'home' | 'away';
  opponent: { nom?: string; logo?: string } | null;
  score: string;
}

export interface PlayerFullStats {
  joueur: any;
  goals: PlayerGoalEntry[];
  totals: {
    matchsJoues: number;
    buts: number;
    minutesEstimees: number;
    passes: number;
    cartonsJaunes: number;
    cartonsRouges: number;
    suspensionsTotal: number;
    matchsManques: number;
  };
  eligibility: {
    available: boolean;
    atRisk: boolean;
    activeYellows: number;
    threshold: number;
    reason?: string;
  };
  cards: any[];
  suspensions: any[];
}

/**
 * Profil statistique complet d'un joueur — partagé entre le portail club
 * (scopé clubId) et l'administration FTF (accès global).
 * Les buts sont dérivés des événements des matchs homologués (source de vérité).
 */
export class PlayerStatsService {
  static async getFullStats(
    joueurId: string,
    opts: { clubId?: string } = {}
  ): Promise<PlayerFullStats | null> {
    const filter: Record<string, unknown> = { _id: joueurId };
    if (opts.clubId) filter.clubId = opts.clubId;

    const joueur = await Joueur.findOne(filter)
      .populate('clubId', 'nom logo code')
      .lean();
    if (!joueur) return null;

    const playerObjectId = new mongoose.Types.ObjectId(joueurId);
    const clubIdStr =
      (joueur.clubId as any)?._id?.toString() ?? String(joueur.clubId ?? '');

    // ── Buts : depuis les événements des matchs homologués ────────────────
    const goalMatches = await Match.find({
      homologue: true,
      evenements: { $elemMatch: { type: 'But', joueurId: playerObjectId } },
    })
      .populate('homeClubId', 'nom logo')
      .populate('awayClubId', 'nom logo')
      .select('date journee scoreHome scoreAway evenements homeClubId awayClubId')
      .sort({ date: -1 })
      .lean();

    const goals: PlayerGoalEntry[] = [];
    for (const m of goalMatches) {
      const isHome = (m.homeClubId as any)?._id?.toString() === clubIdStr;
      for (const ev of m.evenements || []) {
        if (ev.type === 'But' && ev.joueurId?.toString() === joueurId.toString()) {
          goals.push({
            matchId: String(m._id),
            date: m.date,
            journee: m.journee,
            minute: ev.minute,
            homeAway: isHome ? 'home' : 'away',
            opponent: (isHome ? (m.awayClubId as any) : (m.homeClubId as any)) ?? null,
            score: `${m.scoreHome} - ${m.scoreAway}`,
          });
        }
      }
    }

    // ── Cartons + suspensions ─────────────────────────────────────────────
    const [cards, suspensions, matchsManques] = await Promise.all([
      DisciplinaryCard.find({ joueurId })
        .populate({
          path: 'matchId',
          select: 'date journee scoreHome scoreAway homeClubId awayClubId',
          populate: [
            { path: 'homeClubId', select: 'nom' },
            { path: 'awayClubId', select: 'nom' },
          ],
        })
        .populate('competitionId', 'nom')
        .sort({ createdAt: -1 })
        .lean(),
      Suspension.find({ joueurId }).sort({ createdAt: -1 }).lean(),
      SuspensionServiceEntry.countDocuments({ joueurId, counted: true }),
    ]);

    // ── Éligibilité ───────────────────────────────────────────────────────
    const activeYellows = cards.filter(
      (c: any) => c.cardType === 'YELLOW' && c.accumulationStatus === 'ACTIVE'
    ).length;
    const activeSuspensions = suspensions.filter(
      (s: any) => s.status === 'ACTIVE' || s.status === 'PROVISIONAL'
    );

    const ruleSet = await DisciplinaryRuleSet.findOne({
      ...(joueur.organizationId ? { organizationId: joueur.organizationId } : {}),
      active: true,
    })
      .sort({ version: -1 })
      .lean();
    const threshold = ruleSet?.yellowCardThreshold ?? 3;

    const available = activeSuspensions.length === 0;
    const atRisk = available && activeYellows >= threshold - 1 && activeYellows > 0;

    let reason: string | undefined;
    if (!available) {
      const s: any = activeSuspensions[0];
      reason =
        s.status === 'PROVISIONAL'
          ? 'Suspension provisoire — décision disciplinaire en attente'
          : `Suspendu — ${s.matchesRemaining} match(s) restant(s)`;
    }

    const stats = (joueur as any).stats || {};
    const matchsJoues = stats.matchsJoues || 0;

    return {
      joueur,
      goals,
      totals: {
        matchsJoues,
        buts: goals.length || stats.buts || 0,
        // Approximation affichée comme telle dans l'UI (pas de suivi des remplacements)
        minutesEstimees: matchsJoues * 90,
        passes: stats.passes || 0,
        cartonsJaunes: cards.filter((c: any) => c.cardType === 'YELLOW').length,
        cartonsRouges: cards.filter(
          (c: any) => c.cardType === 'DIRECT_RED' || c.cardType === 'SECOND_YELLOW_RED'
        ).length,
        suspensionsTotal: suspensions.length,
        matchsManques,
      },
      eligibility: { available, atRisk, activeYellows, threshold, reason },
      cards,
      suspensions,
    };
  }
}

export default PlayerStatsService;
