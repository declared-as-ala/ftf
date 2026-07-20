'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  Zap,
  Trophy,
  Circle,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
} from 'lucide-react';

interface Club {
  _id: string;
  nom: string;
  logo?: string;
  code: string;
}

interface Match {
  _id: string;
  homeClubId: Club;
  awayClubId: Club;
  date: string;
  stade: string;
  statut: string;
  scoreHome: number;
  scoreAway: number;
  homologue: boolean;
  notes?: string;
  journee: number;
  evenements?: any[];
}

interface Round {
  _id: string;
  number: number;
  name: string;
  dateDebut: string;
  dateFin: string;
  status: string;
}

interface ScoreDraft {
  [matchId: string]: { scoreHome: string; scoreAway: string; statut: string; notes: string };
}

const STATUS_COLORS: Record<string, string> = {
  Programmé: 'bg-blue-500/10 text-blue-600 border-blue-300 dark:text-blue-400',
  Brouillon: 'bg-amber-500/10 text-amber-600 border-amber-300 dark:text-amber-400',
  Terminé: 'bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:text-emerald-400',
  Reporté: 'bg-slate-500/10 text-slate-600 border-slate-300 dark:text-slate-400',
  Annulé: 'bg-red-500/10 text-red-600 border-red-300 dark:text-red-400',
  'En Cours': 'bg-orange-500/10 text-orange-600 border-orange-300 dark:text-orange-400',
};

export default function RoundDetailPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  const roundId = params.roundId as string;

  const [round, setRound] = useState<Round | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drafts, setDrafts] = useState<ScoreDraft>({});
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [finalizingMatchId, setFinalizingMatchId] = useState<string | null>(null);
  const [isFinalizingAll, setIsFinalizingAll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [reopenMatchId, setReopenMatchId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  // Referee management states
  const [referees, setReferees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [expandedRefereeMatchId, setExpandedRefereeMatchId] = useState<string | null>(null);
  const [refereeDrafts, setRefereeDrafts] = useState<Record<string, { main: string; assistant1: string; assistant2: string; fourth: string; notes: string; reason: string }>>({});
  const [refereeErrors, setRefereeErrors] = useState<Record<string, string>>({});
  const [refereeSuccess, setRefereeSuccess] = useState<Record<string, string>>({});
  const [showReasonInput, setShowReasonInput] = useState<Record<string, 'publish' | 'cancel' | null>>({});

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/${competitionId}/rounds/${roundId}`);
      if (!res.ok) {
        router.push(`/admin/competitions/${competitionId}`);
        return;
      }
      const data = await res.json();
      setRound(data.round);

      const ms: Match[] = data.matches;
      setMatches(ms);

      // Seed draft state with current DB values
      const initialDrafts: ScoreDraft = {};
      for (const m of ms) {
        initialDrafts[m._id] = {
          scoreHome: m.scoreHome.toString(),
          scoreAway: m.scoreAway.toString(),
          statut: m.statut,
          notes: m.notes || '',
        };
      }
      setDrafts(initialDrafts);

      // Fetch active referees list
      const refsRes = await fetch('/api/admin/referees?limit=100');
      if (refsRes.ok) {
        const refsData = await refsRes.json();
        setReferees((refsData.referees || []).filter((r: any) => r.status !== 'ARCHIVED'));
      }

      // Latest assignments mapped by matchId
      const latestAss = data.latestAssignments || {};
      setAssignments(latestAss);

      // Seed refereeDrafts state
      const initialRefereeDrafts: typeof refereeDrafts = {};
      for (const m of ms) {
        const ass = latestAss[m._id];
        if (ass) {
          const mainRef = ass.referees.find((r: any) => r.role === 'MAIN')?.refereeId?._id || '';
          const assistant1 = ass.referees.find((r: any) => r.role === 'ASSISTANT_1')?.refereeId?._id || '';
          const assistant2 = ass.referees.find((r: any) => r.role === 'ASSISTANT_2')?.refereeId?._id || '';
          const fourth = ass.referees.find((r: any) => r.role === 'FOURTH_OFFICIAL')?.refereeId?._id || '';
          initialRefereeDrafts[m._id] = {
            main: mainRef,
            assistant1,
            assistant2,
            fourth,
            notes: ass.notes || '',
            reason: '',
          };
        } else {
          initialRefereeDrafts[m._id] = {
            main: '',
            assistant1: '',
            assistant2: '',
            fourth: '',
            notes: '',
            reason: '',
          };
        }
      }
      setRefereeDrafts(initialRefereeDrafts);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [roundId]);

  const handleDraftChange = (matchId: string, field: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value },
    }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[matchId];
      return copy;
    });
  };

  const handleSaveDraft = async (matchId: string) => {
    setSavingMatchId(matchId);
    setErrors((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    const d = drafts[matchId];
    try {
      const res = await fetch(`/api/admin/matchs/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saisonId: undefined,
          scoreHome: Number(d.scoreHome),
          scoreAway: Number(d.scoreAway),
          statut: d.notes !== (matches.find(m => m._id === matchId)?.notes || '') ? 'Brouillon' : (d.statut === 'Programmé' && (Number(d.scoreHome) > 0 || Number(d.scoreAway) > 0) ? 'Brouillon' : d.statut),
          notes: d.notes,
          ...(matches.find(m => m._id === matchId) && {
            saisonId: (matches.find(m => m._id === matchId) as any).saisonId || undefined,
            competitionId: competitionId,
            homeClubId: matches.find(m => m._id === matchId)!.homeClubId._id,
            awayClubId: matches.find(m => m._id === matchId)!.awayClubId._id,
            date: matches.find(m => m._id === matchId)!.date,
            stade: matches.find(m => m._id === matchId)!.stade,
          })
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setErrors(prev => ({ ...prev, [matchId]: err.error || 'Erreur lors de la sauvegarde' }));
      } else {
        setSuccessMsg('Brouillon enregistré');
        setTimeout(() => setSuccessMsg(''), 2500);
        await fetchData();
      }
    } catch {
      setErrors(prev => ({ ...prev, [matchId]: 'Erreur réseau' }));
    } finally {
      setSavingMatchId(null);
    }
  };

  const handleFinalize = async (matchId: string) => {
    setFinalizingMatchId(matchId);
    setErrors((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    try {
      await handleSaveDraft(matchId);

      const res = await fetch(`/api/admin/matches/${matchId}/finalize`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(prev => ({ ...prev, [matchId]: data.error || 'Erreur lors de l\'homologation' }));
      } else {
        setSuccessMsg(data.status === 'already_finalized' ? 'Match déjà homologué' : 'Match homologué avec succès !');
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchData();
      }
    } catch {
      setErrors(prev => ({ ...prev, [matchId]: 'Erreur réseau' }));
    } finally {
      setFinalizingMatchId(null);
    }
  };

  const handleFinalizeAll = async () => {
    setIsFinalizingAll(true);
    setSuccessMsg('');
    const finalizable = matches.filter(m => !m.homologue && m.statut !== 'Reporté' && m.statut !== 'Annulé');
    let count = 0;
    for (const m of finalizable) {
      const res = await fetch(`/api/admin/matches/${m._id}/finalize`, { method: 'POST' });
      if (res.ok) count++;
    }
    setSuccessMsg(`${count} match(s) homologué(s)`);
    setTimeout(() => setSuccessMsg(''), 3000);
    await fetchData();
    setIsFinalizingAll(false);
  };

  const handleReopen = async (matchId: string) => {
    if (!reopenReason.trim() || reopenReason.length < 5) {
      setErrors(prev => ({ ...prev, [matchId]: 'Veuillez saisir une raison (min. 5 caractères)' }));
      return;
    }
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reopenReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(prev => ({ ...prev, [matchId]: data.error || 'Erreur lors de la réouverture' }));
      } else {
        setReopenMatchId(null);
        setReopenReason('');
        setSuccessMsg('Match rouvert — en brouillon');
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchData();
      }
    } catch {
      setErrors(prev => ({ ...prev, [matchId]: 'Erreur réseau' }));
    }
  };

  // Referee assignment event handlers
  const handleRefereeDraftChange = (matchId: string, field: string, value: string) => {
    setRefereeDrafts((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value },
    }));
    setRefereeErrors((prev) => { const copy = { ...prev }; delete copy[matchId]; return copy; });
    setRefereeSuccess((prev) => { const copy = { ...prev }; delete copy[matchId]; return copy; });
  };

  const handleSaveRefereeDraft = async (matchId: string) => {
    setRefereeErrors((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    setRefereeSuccess((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    const draft = refereeDrafts[matchId];
    if (!draft) return;

    const refsList: any[] = [];
    if (draft.main) refsList.push({ refereeId: draft.main, role: 'MAIN' });
    if (draft.assistant1) refsList.push({ refereeId: draft.assistant1, role: 'ASSISTANT_1' });
    if (draft.assistant2) refsList.push({ refereeId: draft.assistant2, role: 'ASSISTANT_2' });
    if (draft.fourth) refsList.push({ refereeId: draft.fourth, role: 'FOURTH_OFFICIAL' });

    try {
      const res = await fetch(`/api/admin/matches/${matchId}/officials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referees: refsList, notes: draft.notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefereeErrors((prev) => ({ ...prev, [matchId]: data.error || 'Erreur lors de la sauvegarde du brouillon' }));
      } else {
        setRefereeSuccess((prev) => ({ ...prev, [matchId]: 'Brouillon des arbitres enregistré !' }));
        setTimeout(() => setRefereeSuccess((prev) => { const c = { ...prev }; delete c[matchId]; return c; }), 3000);
        await fetchData();
      }
    } catch {
      setRefereeErrors((prev) => ({ ...prev, [matchId]: 'Erreur réseau' }));
    }
  };

  const handlePublishRefereeAssignment = async (matchId: string, version: number) => {
    setRefereeErrors((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    setRefereeSuccess((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    const draft = refereeDrafts[matchId];
    const isUpdate = assignments[matchId]?.status === 'PUBLISHED';

    if (isUpdate && (!draft.reason || draft.reason.trim().length < 5)) {
      setRefereeErrors((prev) => ({ ...prev, [matchId]: 'Un motif de modification (min. 5 caractères) est requis' }));
      return;
    }

    try {
      const res = await fetch(`/api/admin/matches/${matchId}/officials/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, reason: draft.reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefereeErrors((prev) => ({ ...prev, [matchId]: data.error || 'Erreur lors de la publication' }));
      } else {
        setRefereeSuccess((prev) => ({ ...prev, [matchId]: 'Désignation publiée avec succès !' }));
        setShowReasonInput((prev) => ({ ...prev, [matchId]: null }));
        setRefereeDrafts((prev) => ({ ...prev, [matchId]: { ...prev[matchId], reason: '' } }));
        setTimeout(() => setRefereeSuccess((prev) => { const c = { ...prev }; delete c[matchId]; return c; }), 3000);
        await fetchData();
      }
    } catch {
      setRefereeErrors((prev) => ({ ...prev, [matchId]: 'Erreur réseau' }));
    }
  };

  const handleCancelRefereeAssignment = async (matchId: string, version: number) => {
    setRefereeErrors((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    setRefereeSuccess((prev) => { const c = { ...prev }; delete c[matchId]; return c; });
    const draft = refereeDrafts[matchId];

    if (!draft.reason || draft.reason.trim().length < 5) {
      setRefereeErrors((prev) => ({ ...prev, [matchId]: 'Un motif d\'annulation (min. 5 caractères) est requis' }));
      return;
    }

    try {
      const res = await fetch(`/api/admin/matches/${matchId}/officials/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, reason: draft.reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefereeErrors((prev) => ({ ...prev, [matchId]: data.error || 'Erreur lors de l\'annulation' }));
      } else {
        setRefereeSuccess((prev) => ({ ...prev, [matchId]: 'Désignation annulée avec succès' }));
        setShowReasonInput((prev) => ({ ...prev, [matchId]: null }));
        setRefereeDrafts((prev) => ({ ...prev, [matchId]: { ...prev[matchId], reason: '' } }));
        setTimeout(() => setRefereeSuccess((prev) => { const c = { ...prev }; delete c[matchId]; return c; }), 3000);
        await fetchData();
      }
    } catch {
      setRefereeErrors((prev) => ({ ...prev, [matchId]: 'Erreur réseau' }));
    }
  };

  if (isLoading || !round) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-muted-foreground">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Chargement de la journée...
      </div>
    );
  }

  const totalMatches = matches.length;
  const homologues = matches.filter(m => m.homologue).length;
  const enAttente = matches.filter(m => !m.homologue && m.statut !== 'Reporté' && m.statut !== 'Annulé').length;
  const reportes = matches.filter(m => m.statut === 'Reporté' || m.statut === 'Annulé').length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        onClick={() => router.push(`/admin/competitions/${competitionId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la compétition
      </div>

      <PageHeader
        title={round.name}
        description={`Du ${new Date(round.dateDebut).toLocaleDateString('fr-FR')} au ${new Date(round.dateFin).toLocaleDateString('fr-FR')}`}
      >
        <StatusBadge status={round.status} />
      </PageHeader>

      {/* Success message */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm p-3 rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalMatches}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Homologués</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{homologues}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">En attente</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{enAttente}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Reportés / Annulés</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-muted-foreground">{reportes}</div></CardContent>
        </Card>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Grille des rencontres</h2>
        {enAttente > 0 && (
          <button
            onClick={handleFinalizeAll}
            disabled={isFinalizingAll}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {isFinalizingAll ? 'Homologation...' : `Homologuer tous (${enAttente})`}
          </button>
        )}
      </div>

      {/* Match Grid */}
      {matches.length === 0 ? (
        <EmptyState title="Aucun match dans cette journée" description="Aucune rencontre n'a été programmée pour cette journée." icon={Calendar} />
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const d = drafts[match._id] || { scoreHome: '0', scoreAway: '0', statut: match.statut, notes: '' };
            const isLocked = match.homologue;
            const isSaving = savingMatchId === match._id;
            const isFinalizing = finalizingMatchId === match._id;
            const matchError = errors[match._id];
            const isReopening = reopenMatchId === match._id;

            return (
              <Card key={match._id} className={`overflow-hidden transition-all ${isLocked ? 'ring-1 ring-emerald-500/30 bg-emerald-500/5' : ''}`}>
                <CardContent className="p-0">
                  {/* Match header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(match.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      <span>·</span>
                      <span>{new Date(match.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>·</span>
                      <span>{match.stade}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLocked ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Homologué
                        </span>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_COLORS[match.statut] || ''}`}>
                          {match.statut}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score row */}
                  <div className="flex items-center justify-center gap-6 px-6 py-5">
                    {/* Home Club */}
                    <div className="flex-1 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div>
                          <p className="font-bold text-foreground text-sm sm:text-base">{match.homeClubId?.nom || 'Équipe A'}</p>
                          <p className="text-xs text-muted-foreground">{match.homeClubId?.code}</p>
                        </div>
                        {match.homeClubId?.logo ? (
                          <img src={match.homeClubId.logo} alt="" className="h-10 w-10 object-contain rounded" />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center font-bold text-xs text-muted-foreground">{match.homeClubId?.code}</div>
                        )}
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="flex items-center gap-3">
                      {isLocked ? (
                        <>
                          <span className="text-3xl font-black text-foreground w-10 text-center">{match.scoreHome}</span>
                          <span className="text-xl font-bold text-muted-foreground">–</span>
                          <span className="text-3xl font-black text-foreground w-10 text-center">{match.scoreAway}</span>
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={d.scoreHome}
                            onChange={(e) => handleDraftChange(match._id, 'scoreHome', e.target.value)}
                            className="w-14 h-12 text-center text-2xl font-black border-2 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                            id={`score-home-${match._id}`}
                          />
                          <span className="text-xl font-bold text-muted-foreground">–</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={d.scoreAway}
                            onChange={(e) => handleDraftChange(match._id, 'scoreAway', e.target.value)}
                            className="w-14 h-12 text-center text-2xl font-black border-2 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                            id={`score-away-${match._id}`}
                          />
                        </>
                      )}
                    </div>

                    {/* Away Club */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3">
                        {match.awayClubId?.logo ? (
                          <img src={match.awayClubId.logo} alt="" className="h-10 w-10 object-contain rounded" />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center font-bold text-xs text-muted-foreground">{match.awayClubId?.code}</div>
                        )}
                        <div>
                          <p className="font-bold text-foreground text-sm sm:text-base">{match.awayClubId?.nom || 'Équipe B'}</p>
                          <p className="text-xs text-muted-foreground">{match.awayClubId?.code}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error message */}
                  {matchError && (
                    <div className="mx-4 mb-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs p-2 rounded-md flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {matchError}
                    </div>
                  )}

                  {/* Notes + actions */}
                  {!isLocked && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Status selector */}
                      <div className="flex items-center gap-3">
                        <select
                          value={d.statut}
                          onChange={(e) => handleDraftChange(match._id, 'statut', e.target.value)}
                          className="text-xs h-8 rounded-md border border-input bg-background px-2 pr-6 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="Programmé">Programmé</option>
                          <option value="Brouillon">Brouillon (score saisi)</option>
                          <option value="En Cours">En cours</option>
                          <option value="Reporté">Reporté</option>
                          <option value="Annulé">Annulé</option>
                          <option value="Abandonné">Abandonné</option>
                          <option value="Forfait">Forfait</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Notes optionnelles..."
                          value={d.notes}
                          onChange={(e) => handleDraftChange(match._id, 'notes', e.target.value)}
                          className="flex-1 text-xs h-8 rounded-md border border-input bg-background px-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSaveDraft(match._id)}
                          disabled={isSaving || isFinalizing}
                          id={`save-draft-${match._id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {isSaving ? 'Sauvegarde...' : 'Enregistrer brouillon'}
                        </button>
                        <button
                          onClick={() => handleFinalize(match._id)}
                          disabled={isSaving || isFinalizing}
                          id={`finalize-${match._id}`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isFinalizing ? 'Homologation...' : 'Homologuer'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reopen section for locked matches */}
                  {isLocked && (
                    <div className="px-4 pb-3">
                      {isReopening ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Raison de réouverture (min. 5 caractères)..."
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            className="flex-1 text-xs h-8 rounded-md border border-input bg-background px-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            autoFocus
                          />
                          <button
                            onClick={() => handleReopen(match._id)}
                            className="text-xs font-medium text-white bg-amber-600 px-3 py-1.5 rounded-md hover:bg-amber-700 transition-colors"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => { setReopenMatchId(null); setReopenReason(''); }}
                            className="text-xs font-medium border px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReopenMatchId(match._id)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" /> Rouvrir ce match
                        </button>
                      )}
                    </div>
                  )}

                  {/* Referee Assignment Section */}
                  <div className="border-t px-4 py-3 bg-slate-50 dark:bg-slate-900/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-muted-foreground">Arbitres :</span>
                        {assignments[match._id] ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground">
                              {assignments[match._id].referees.find((r: any) => r.role === 'MAIN')?.refereeId?.displayName || 
                               `${assignments[match._id].referees.find((r: any) => r.role === 'MAIN')?.refereeId?.prenom || ''} ${assignments[match._id].referees.find((r: any) => r.role === 'MAIN')?.refereeId?.nom || ''}` || 'Non défini'}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[10px] rounded font-semibold border ${
                              assignments[match._id].status === 'PUBLISHED'
                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400'
                                : assignments[match._id].status === 'CANCELLED'
                                ? 'bg-rose-500/10 text-rose-700 border-rose-300 dark:text-rose-400'
                                : 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400'
                            }`}>
                              {assignments[match._id].status === 'PUBLISHED' ? 'Officiel' : assignments[match._id].status === 'CANCELLED' ? 'Annulé' : 'Brouillon'} (v{assignments[match._id].version})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Non désigné</span>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedRefereeMatchId(expandedRefereeMatchId === match._id ? null : match._id)}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                      >
                        {expandedRefereeMatchId === match._id ? 'Masquer' : 'Gérer les arbitres'}
                      </button>
                    </div>

                    {expandedRefereeMatchId === match._id && (
                      <div className="mt-4 pt-3 border-t border-dashed space-y-4">
                        {refereeSuccess[match._id] && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs p-2 rounded flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            {refereeSuccess[match._id]}
                          </div>
                        )}
                        {refereeErrors[match._id] && (
                          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-2.5 rounded space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              <span>Attention : Conflit de désignation</span>
                            </div>
                            <p className="pl-5.5 font-medium">{refereeErrors[match._id]}</p>
                            <p className="pl-5.5 text-[10px] text-muted-foreground">Action corrective : Veuillez assigner un autre arbitre disponible ou modifier les horaires de rencontre.</p>
                          </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Arbitre Principal (MAIN)</label>
                            <select
                              value={refereeDrafts[match._id]?.main || ''}
                              onChange={(e) => handleRefereeDraftChange(match._id, 'main', e.target.value)}
                              className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">— Sélectionner —</option>
                              {referees.map((r) => (
                                <option key={r._id} value={r._id}>{r.displayName || `${r.prenom} ${r.nom}`} ({r.categorie})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Premier Assistant (ASSISTANT_1)</label>
                            <select
                              value={refereeDrafts[match._id]?.assistant1 || ''}
                              onChange={(e) => handleRefereeDraftChange(match._id, 'assistant1', e.target.value)}
                              className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">— Aucun —</option>
                              {referees.map((r) => (
                                <option key={r._id} value={r._id}>{r.displayName || `${r.prenom} ${r.nom}`} ({r.categorie})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deuxième Assistant (ASSISTANT_2)</label>
                            <select
                              value={refereeDrafts[match._id]?.assistant2 || ''}
                              onChange={(e) => handleRefereeDraftChange(match._id, 'assistant2', e.target.value)}
                              className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">— Aucun —</option>
                              {referees.map((r) => (
                                <option key={r._id} value={r._id}>{r.displayName || `${r.prenom} ${r.nom}`} ({r.categorie})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quatrième Officiel (FOURTH_OFFICIAL)</label>
                            <select
                              value={refereeDrafts[match._id]?.fourth || ''}
                              onChange={(e) => handleRefereeDraftChange(match._id, 'fourth', e.target.value)}
                              className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">— Aucun —</option>
                              {referees.map((r) => (
                                <option key={r._id} value={r._id}>{r.displayName || `${r.prenom} ${r.nom}`} ({r.categorie})</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes / Remarques internes</label>
                          <input
                            type="text"
                            placeholder="Notes d'affectation..."
                            value={refereeDrafts[match._id]?.notes || ''}
                            onChange={(e) => handleRefereeDraftChange(match._id, 'notes', e.target.value)}
                            className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>

                        {/* Motif sub-form wrapper */}
                        {showReasonInput[match._id] && (
                          <div className="bg-muted/50 p-3 rounded-md border space-y-2">
                            <label className="text-[10px] font-bold text-foreground flex items-center gap-1">
                              <span>
                                {showReasonInput[match._id] === 'publish'
                                  ? 'Motif de modification de la désignation officielle'
                                  : 'Motif d\'annulation de la désignation officielle'
                                }
                              </span>
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Indiquer la raison (changement de planning, blessure, etc.)..."
                              value={refereeDrafts[match._id]?.reason || ''}
                              onChange={(e) => handleRefereeDraftChange(match._id, 'reason', e.target.value)}
                              className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                              id={`referee-reason-${match._id}`}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setShowReasonInput((prev) => ({ ...prev, [match._id]: null }));
                                  handleRefereeDraftChange(match._id, 'reason', '');
                                }}
                                className="px-2.5 py-1 text-[11px] font-medium border rounded hover:bg-accent"
                              >
                                Retour
                              </button>
                              <button
                                onClick={() => {
                                  if (showReasonInput[match._id] === 'publish') {
                                    handlePublishRefereeAssignment(match._id, assignments[match._id]?.version || 1);
                                  } else {
                                    handleCancelRefereeAssignment(match._id, assignments[match._id]?.version || 1);
                                  }
                                }}
                                id={`submit-referee-action-${match._id}`}
                                className={`px-2.5 py-1 text-[11px] font-semibold text-white rounded ${
                                  showReasonInput[match._id] === 'publish'
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                              >
                                Valider
                              </button>
                            </div>
                          </div>
                        )}

                        {!showReasonInput[match._id] && (
                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                              onClick={() => handleSaveRefereeDraft(match._id)}
                              id={`save-referee-draft-${match._id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border rounded-md hover:bg-accent transition-colors"
                            >
                              <Save className="h-3.5 w-3.5" />
                              Enregistrer Brouillon
                            </button>

                            {assignments[match._id]?.status === 'PUBLISHED' ? (
                              <>
                                <button
                                  onClick={() => setShowReasonInput((prev) => ({ ...prev, [match._id]: 'publish' }))}
                                  id={`modify-referee-${match._id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  Modifier & Publier
                                </button>
                                <button
                                  onClick={() => setShowReasonInput((prev) => ({ ...prev, [match._id]: 'cancel' }))}
                                  id={`cancel-referee-${match._id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-md hover:bg-rose-700 transition-colors"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  Annuler Désignation
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handlePublishRefereeAssignment(match._id, assignments[match._id]?.version || 1)}
                                id={`publish-referee-${match._id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                Publier Désignation
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
