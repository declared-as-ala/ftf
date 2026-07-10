import mongoose from 'mongoose';
import { parse } from 'json2csv';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import Standings from '@/lib/models/Standings';
import DisciplinaryCard from '@/lib/models/DisciplinaryCard';
import Suspension from '@/lib/models/Suspension';
import Joueur from '@/lib/models/Joueur';
import Club from '@/lib/models/Club';
import Competition from '@/lib/models/Competition';

export type ReportFormat = 'csv' | 'excel';
export type ReportType =
  | 'fixtures-results'
  | 'standings'
  | 'goalscorers'
  | 'cards-by-club'
  | 'cards-by-player'
  | 'two-warning-players'
  | 'suspensions-active'
  | 'suspensions-provisional'
  | 'suspensions-served'
  | 'red-decisions'
  | 'anomalies'
  | 'club-disciplinary-summary';

export interface ReportMeta {
  type: ReportType;
  label: string;
  description: string;
  forAdmin: boolean;
  forClub: boolean;
}

export const REPORT_CATALOG: ReportMeta[] = [
  { type: 'fixtures-results', label: 'Calendrier & Résultats', description: 'Tous les matchs par compétition/journée', forAdmin: true, forClub: true },
  { type: 'standings', label: 'Classement', description: 'Classement complet avec forme et statistiques', forAdmin: true, forClub: true },
  { type: 'goalscorers', label: 'Buteurs', description: 'Classement des buteurs par compétition', forAdmin: true, forClub: true },
  { type: 'cards-by-club', label: 'Cartons par Club', description: 'Récapitulatif des cartons par club', forAdmin: true, forClub: false },
  { type: 'cards-by-player', label: 'Cartons par Joueur', description: 'Détail des cartons par joueur', forAdmin: true, forClub: true },
  { type: 'two-warning-players', label: 'Joueurs à 2 Avertissements', description: 'Joueurs à risque de suspension', forAdmin: true, forClub: true },
  { type: 'suspensions-active', label: 'Suspensions Actives', description: 'Suspensions en cours', forAdmin: true, forClub: true },
  { type: 'suspensions-provisional', label: 'Suspensions Provisoires', description: 'Suspensions en attente de décision (cartons rouges)', forAdmin: true, forClub: true },
  { type: 'suspensions-served', label: 'Suspensions Purgeés', description: 'Suspensions déjà servies', forAdmin: true, forClub: true },
  { type: 'red-decisions', label: 'Décisions Cartons Rouges', description: 'Décisions disciplinaires pour cartons rouges', forAdmin: true, forClub: false },
  { type: 'anomalies', label: 'Anomalies', description: 'Anomalies détectées (joueurs suspendus alignés)', forAdmin: true, forClub: false },
  { type: 'club-disciplinary-summary', label: 'Résumé Disciplinaire', description: 'Synthèse disciplinaire complète par club', forAdmin: true, forClub: true },
];

export class ReportService {
  static async generate(
    type: ReportType,
    params: {
      competitionId?: string;
      saisonId?: string;
      clubId?: string;
      format?: ReportFormat;
    }
  ): Promise<{ data: any[]; filename: string }> {
    await connectDB();
    const format = params.format || 'csv';

    switch (type) {
      case 'fixtures-results': return this.fixturesResults(params);
      case 'standings': return this.standings(params);
      case 'goalscorers': return this.goalscorers(params);
      case 'cards-by-club': return this.cardsByClub(params);
      case 'cards-by-player': return this.cardsByPlayer(params);
      case 'two-warning-players': return this.twoWarningPlayers(params);
      case 'suspensions-active': return this.suspensionsByStatus(params, ['ACTIVE']);
      case 'suspensions-provisional': return this.suspensionsByStatus(params, ['PROVISIONAL']);
      case 'suspensions-served': return this.suspensionsByStatus(params, ['SERVED']);
      case 'red-decisions': return this.redDecisions(params);
      case 'anomalies': return this.anomalies(params);
      case 'club-disciplinary-summary': return this.clubDisciplinarySummary(params);
      default: throw new Error(`Type de rapport inconnu: ${type}`);
    }
  }

  static toCsv(data: any[], fields?: string[]): string {
    try {
      return parse(data, { fields });
    } catch {
      return parse(data, {});
    }
  }

  private static async fixturesResults(params: { competitionId?: string; saisonId?: string; clubId?: string }) {
    const query: any = {};
    if (params.competitionId) query.competitionId = params.competitionId;
    if (params.saisonId) query.saisonId = params.saisonId;
    if (params.clubId) query.$or = [{ homeClubId: params.clubId }, { awayClubId: params.clubId }];

    const matches = await Match.find(query)
      .populate('homeClubId', 'nom')
      .populate('awayClubId', 'nom')
      .populate('competitionId', 'nom')
      .sort({ date: 1 })
      .lean();

    const data = matches.map((m: any) => ({
      Date: new Date(m.date).toLocaleDateString('fr-FR'),
      Compétition: m.competitionId?.nom,
      Journée: m.journee,
    }));
    return { data, filename: `calendrier-resultats-${Date.now()}` };
  }

  private static async standings(params: { competitionId?: string }) {
    if (!params.competitionId) throw new Error('competitionId requis');
    const standings = await Standings.findOne({ competitionId: params.competitionId })
      .populate('rows.clubId', 'nom')
      .lean();

    if (!standings) return { data: [], filename: `classement-${Date.now()}` };

    const data = standings.rows
      .sort((a: any, b: any) => a.position - b.position)
      .map((r: any) => ({
        Position: r.position,
        Club: r.clubId?.nom,
        J: r.played,
        G: r.won,
        N: r.drawn,
        P: r.lost,
        BP: r.goalsFor,
        BC: r.goalsAgainst,
        Diff: r.goalDifference,
        Pts: r.points,
      }));
    return { data, filename: `classement-${Date.now()}` };
  }

  private static async goalscorers(params: { competitionId?: string }) {
    const query: any = { 'evenements.type': 'But' };
    if (params.competitionId) query.competitionId = params.competitionId;

    const matches = await Match.find(query)
      .populate('evenements.joueurId', 'nom prenom clubId')
      .populate('competitionId', 'nom')
      .lean();

    const goals: Record<string, { joueur: string; club: string; competition: string; buts: number }> = {};
    for (const m of matches as any[]) {
      for (const ev of m.evenements || []) {
        if (ev.type === 'But' && ev.joueurId) {
          const key = ev.joueurId._id.toString();
          if (!goals[key]) {
            goals[key] = { joueur: `${ev.joueurId.prenom} ${ev.joueurId.nom}`, club: '', competition: m.competitionId?.nom || '', buts: 0 };
          }
          goals[key].buts++;
        }
      }
    }

    const data = Object.values(goals).sort((a, b) => b.buts - a.buts);
    return { data, filename: `buteurs-${Date.now()}` };
  }

  private static async cardsByClub(params: { saisonId?: string; competitionId?: string }) {
    const query: any = {};
    if (params.saisonId) query.saisonId = params.saisonId;
    if (params.competitionId) query.competitionId = params.competitionId;

    const cards = await DisciplinaryCard.find(query)
      .populate('clubId', 'nom')
      .lean();

    const agg: Record<string, any> = {};
    for (const c of cards as any[]) {
      const key = c.clubId?._id?.toString() || 'unknown';
      if (!agg[key]) agg[key] = { Club: c.clubId?.nom || 'Inconnu', JAunes: 0, JRouges: 0, SecondJaune: 0 };
      if (c.cardType === 'YELLOW') agg[key].JAunes++;
      else if (c.cardType === 'DIRECT_RED') agg[key].JRouges++;
      else if (c.cardType === 'SECOND_YELLOW_RED') agg[key].SecondJaune++;
    }

    return { data: Object.values(agg), filename: `cartons-par-club-${Date.now()}` };
  }

  private static async cardsByPlayer(params: { saisonId?: string; clubId?: string }) {
    const query: any = {};
    if (params.saisonId) query.saisonId = params.saisonId;
    if (params.clubId) query.clubId = params.clubId;

    const cards = await DisciplinaryCard.find(query)
      .populate('joueurId', 'nom prenom')
      .populate('clubId', 'nom')
      .lean();

    const agg: Record<string, any> = {};
    for (const c of cards as any[]) {
      const key = c.joueurId?._id?.toString() || 'unknown';
      if (!agg[key]) agg[key] = { Joueur: `${c.joueurId?.prenom || ''} ${c.joueurId?.nom || ''}`, Club: c.clubId?.nom || '', J: 0, JR: 0, '2J': 0 };
      if (c.cardType === 'YELLOW') agg[key].J++;
      else if (c.cardType === 'DIRECT_RED') agg[key].JR++;
      else if (c.cardType === 'SECOND_YELLOW_RED') agg[key]['2J']++;
    }

    return { data: Object.values(agg), filename: `cartons-par-joueur-${Date.now()}` };
  }

  private static async twoWarningPlayers(params: { saisonId?: string }) {
    const query: any = { cardType: 'YELLOW', accumulationStatus: 'ACTIVE' };
    if (params.saisonId) query.saisonId = params.saisonId;

    const cards = await DisciplinaryCard.find(query)
      .populate('joueurId', 'nom prenom')
      .populate('clubId', 'nom')
      .lean();

    const count: Record<string, any> = {};
    for (const c of cards as any[]) {
      const key = c.joueurId?._id?.toString() || 'unknown';
      if (!count[key]) count[key] = { Joueur: `${c.joueurId?.prenom || ''} ${c.joueurId?.nom || ''}`, Club: c.clubId?.nom || '', Avertissements: 0 };
      count[key].Avertissements++;
    }

    const data = Object.values(count).filter((r: any) => r.Avertissements >= 2);
    return { data, filename: `joueurs-2-avertissements-${Date.now()}` };
  }

  private static async suspensionsByStatus(params: { clubId?: string }, statuses: string[]) {
    const query: any = { status: { $in: statuses } };
    if (params.clubId) query.clubId = params.clubId;

    const suspensions = await Suspension.find(query)
      .populate('joueurId', 'nom prenom')
      .populate('clubId', 'nom')
      .lean();

    const data = (suspensions as any[]).map((s) => ({
      Joueur: `${s.joueurId?.prenom || ''} ${s.joueurId?.nom || ''}`,
      Club: s.clubId?.nom,
      Type: s.suspensionType,
      Matchs: s.matchesSuspended,
      Purgés: s.matchesServed,
      Restants: s.matchesRemaining,
      Statut: s.status,
    }));
    return { data, filename: `suspensions-${Date.now()}` };
  }

  private static async redDecisions(params: {}) {
    const suspensions = await Suspension.find({
      suspensionType: { $in: ['RED_CARD_PROVISIONAL', 'RED_CARD_FINAL'] },
    })
      .populate('joueurId', 'nom prenom')
      .populate('clubId', 'nom')
      .populate('sourceMatchId', 'date')
      .lean();

    const data = (suspensions as any[]).map((s) => ({
      Joueur: `${s.joueurId?.prenom || ''} ${s.joueurId?.nom || ''}`,
      Club: s.clubId?.nom,
      Type: s.suspensionType,
      Statut: s.status,
      Décision: s.decisionReason || 'En attente',
      Matchs: s.matchesSuspended,
      Date: s.decisionDate ? new Date(s.decisionDate).toLocaleDateString('fr-FR') : '—',
    }));
    return { data, filename: `decisions-cartons-rouges-${Date.now()}` };
  }

  private static async anomalies(params: {}) {
    const SuspensionEntry = (await import('@/lib/models/SuspensionServiceEntry')).default;
    const entries = await SuspensionEntry.find({
      reason: 'SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT',
    })
      .populate('joueurId', 'nom prenom')
      .populate('clubId', 'nom')
      .lean();

    const data = (entries as any[]).map((e) => ({
      Joueur: `${e.joueurId?.prenom || ''} ${e.joueurId?.nom || ''}`,
      Club: e.clubId?.nom,
      Match: e.matchId?.toString() || '',
      Date: new Date(e.processedAt).toLocaleDateString('fr-FR'),
    }));
    return { data, filename: `anomalies-${Date.now()}` };
  }

  private static async clubDisciplinarySummary(params: { saisonId?: string }) {
    const query: any = {};
    if (params.saisonId) query.saisonId = params.saisonId;

    const cards = await DisciplinaryCard.find(query)
      .populate('clubId', 'nom')
      .lean();

    const agg: Record<string, any> = {};
    for (const c of cards as any[]) {
      const key = c.clubId?._id?.toString() || 'unknown';
      if (!agg[key]) agg[key] = { Club: c.clubId?.nom || '', J: 0, JR: 0, '2J': 0, Total: 0 };
      if (c.cardType === 'YELLOW') agg[key].J++;
      else if (c.cardType === 'DIRECT_RED') agg[key].JR++;
      else if (c.cardType === 'SECOND_YELLOW_RED') agg[key]['2J']++;
      agg[key].Total++;
    }

    const data = Object.values(agg);
    return { data, filename: `resume-disciplinaire-${Date.now()}` };
  }
}

export default ReportService;
