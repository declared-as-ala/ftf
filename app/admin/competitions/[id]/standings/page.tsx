'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Trophy, RefreshCw, CheckCircle2, TrendingUp, TrendingDown, Minus, ArrowLeft } from 'lucide-react';

interface StandingsRow {
  clubId: { _id: string; nom: string; logo?: string; code: string };
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string[];
}

interface StandingsData {
  _id?: string;
  competitionId: string;
  rows: StandingsRow[];
  calculatedAt?: string;
  matchesProcessed?: number;
}

const FORM_COLORS: Record<string, string> = {
  W: 'bg-emerald-500 text-white',
  D: 'bg-slate-400 text-white',
  L: 'bg-red-500 text-white',
};

export default function CompetitionStandingsPage() {
  const { id: competitionId } = useParams() as { id: string };
  const router = useRouter();

  const [standings, setStandings] = useState<StandingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStandings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/${competitionId}/standings`);
      const data = await res.json();
      setStandings(data);
    } catch {
      setStandings({ competitionId, rows: [] });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
  }, [competitionId]);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/competitions/${competitionId}/rebuild-standings`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Classement recalculé — ${data.matchesProcessed} match(s) traité(s)`);
        await fetchStandings();
      } else {
        setMessage(data.error || 'Erreur lors du recalcul');
      }
    } catch {
      setMessage('Erreur réseau');
    } finally {
      setIsRebuilding(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const getPositionIcon = (pos: number) => {
    if (pos === 1) return <Trophy className="h-4 w-4 text-amber-500" />;
    if (pos === 2) return <span className="text-slate-400 text-sm font-bold">2</span>;
    if (pos === 3) return <span className="text-amber-700 text-sm font-bold">3</span>;
    return <span className="text-sm text-muted-foreground font-medium">{pos}</span>;
  };

  return (
    <div className="space-y-6">
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        onClick={() => router.push(`/admin/competitions/${competitionId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la compétition
      </div>

      <PageHeader title="Classement" description="Classement de la compétition calculé depuis les matchs homologués">
        <button
          onClick={handleRebuild}
          disabled={isRebuilding}
          id="rebuild-standings-btn"
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRebuilding ? 'animate-spin' : ''}`} />
          {isRebuilding ? 'Recalcul...' : 'Recalculer'}
        </button>
      </PageHeader>

      {message && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 text-sm p-3 rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      )}

      {standings?.calculatedAt && (
        <p className="text-xs text-muted-foreground">
          Dernière mise à jour : {new Date(standings.calculatedAt).toLocaleString('fr-FR')} · {standings.matchesProcessed} match(s) traité(s)
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Chargement...
            </div>
          ) : !standings || standings.rows.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground px-4">
              <Trophy className="h-8 w-8 opacity-30" />
              <p className="text-sm">Aucun classement disponible</p>
              <p className="text-xs">Homologuez des matchs pour voir le classement</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="py-3 px-4 text-left w-10">#</th>
                    <th className="py-3 px-4 text-left">Club</th>
                    <th className="py-3 px-4 text-center">J</th>
                    <th className="py-3 px-4 text-center">G</th>
                    <th className="py-3 px-4 text-center">N</th>
                    <th className="py-3 px-4 text-center">P</th>
                    <th className="py-3 px-4 text-center">BP</th>
                    <th className="py-3 px-4 text-center">BC</th>
                    <th className="py-3 px-4 text-center">Diff</th>
                    <th className="py-3 px-4 text-center">Forme</th>
                    <th className="py-3 px-4 text-center font-bold text-foreground">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.rows.map((row, i) => (
                    <tr
                      key={row.clubId?._id || i}
                      className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center w-6">{getPositionIcon(row.position)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {row.clubId?.logo ? (
                            <img src={row.clubId.logo} alt="" className="h-7 w-7 object-contain rounded" />
                          ) : (
                            <div className="h-7 w-7 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{row.clubId?.code}</div>
                          )}
                          <span className="font-semibold text-foreground">{row.clubId?.nom}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{row.played}</td>
                      <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400">{row.won}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{row.drawn}</td>
                      <td className="py-3 px-4 text-center text-red-600 dark:text-red-400">{row.lost}</td>
                      <td className="py-3 px-4 text-center">{row.goalsFor}</td>
                      <td className="py-3 px-4 text-center">{row.goalsAgainst}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={row.goalDifference > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.goalDifference < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
                          {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-0.5">
                          {(row.form || []).map((f, fi) => (
                            <span key={fi} className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${FORM_COLORS[f] || 'bg-muted text-muted-foreground'}`}>
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-lg font-black text-foreground">{row.points}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
