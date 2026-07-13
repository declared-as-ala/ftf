'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, Goal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { InlineLoader } from '@/components/Loader';

interface CompetitionOption {
  _id: string;
  nom: string;
}

interface StandingRow {
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

interface TopScorer {
  _id: string;
  goals: number;
  joueur: {
    _id: string;
    nom: string;
    prenom: string;
    numeroMaillot?: number;
    photo?: string;
  };
  club?: { _id: string; nom: string; code?: string; logo?: string };
}

export default function ClassementPage() {
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [scorersLoading, setScorersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const res = await fetch('/api/admin/competitions', { cache: 'no-store' });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Erreur lors du chargement des compétitions');
        }
        const data = await res.json();
        setCompetitions(data);
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      }
    };

    fetchCompetitions();
  }, []);

  useEffect(() => {
    const fetchStandings = async () => {
      if (!selectedCompetitionId) {
        setStandings([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/admin/standings?competitionId=${encodeURIComponent(selectedCompetitionId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Erreur lors du calcul du classement');
        }
        const data = await res.json();
        setStandings(data);
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, [selectedCompetitionId]);

  useEffect(() => {
    const fetchScorers = async () => {
      if (!selectedCompetitionId) {
        setScorers([]);
        return;
      }
      try {
        setScorersLoading(true);
        const res = await fetch(
          `/api/admin/competitions/${selectedCompetitionId}/top-scorers?limit=10`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          setScorers(data.scorers || []);
        } else {
          setScorers([]);
        }
      } catch {
        setScorers([]);
      } finally {
        setScorersLoading(false);
      }
    };

    fetchScorers();
  }, [selectedCompetitionId]);

  const selectedCompetition = competitions.find((c) => c._id === selectedCompetitionId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-7 w-7 text-yellow-500" />
            Classement
          </h1>
          <p className="text-muted-foreground mt-2">
            Classement automatique des équipes en fonction des résultats des matchs terminés.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtre</CardTitle>
          <CardDescription>Sélectionnez une compétition pour afficher son classement.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="competition">Compétition</Label>
            <select
              id="competition"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedCompetitionId}
              onChange={(e) => setSelectedCompetitionId(e.target.value)}
            >
              <option value="">Sélectionner une compétition</option>
              {competitions.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>
            Classement {selectedCompetition ? `– ${selectedCompetition.nom}` : ''}
          </CardTitle>
          <CardDescription>
            {loading ? (
              <span className="flex items-center gap-2">
                <InlineLoader size="sm" />
                Calcul du classement...
              </span>
            ) : standings.length ? (
              `Total : ${standings.length} équipe(s)`
            ) : (
              'Aucune donnée disponible. Assurez-vous qu\'il existe des matchs terminés pour cette compétition.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <InlineLoader size="lg" />
            </div>
          ) : standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun match terminé ne permet de calculer le classement pour cette compétition.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left">#</th>
                    <th className="py-2 pr-3 text-left">Équipe</th>
                    <th className="py-2 px-2 text-center">MJ</th>
                    <th className="py-2 px-2 text-center">V</th>
                    <th className="py-2 px-2 text-center">N</th>
                    <th className="py-2 px-2 text-center">D</th>
                    <th className="py-2 px-2 text-center">BM</th>
                    <th className="py-2 px-2 text-center">BE</th>
                    <th className="py-2 px-2 text-center">Diff</th>
                    <th className="py-2 pl-2 text-center">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, index) => (
                    <tr
                      key={row.clubId}
                      className={cn(
                        'border-b last:border-0',
                        index < 3 ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : undefined
                      )}
                    >
                      <td className="py-2 pr-3 text-xs font-semibold text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="relative h-6 w-6 rounded-full bg-white shadow overflow-hidden flex items-center justify-center">
                            {row.logo ? (
                              <Image
                                src={row.logo}
                                alt={row.nom}
                                fill
                                className="object-contain"
                              />
                            ) : (
                              <span className="text-[11px] font-semibold">
                                {row.nom.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium">{row.nom}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-xs">{row.matchesJoues}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.victoires}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.nuls}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.defaites}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.butsMarques}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.butsEncaisses}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.difference}</td>
                      <td className="py-2 pl-2 text-center text-xs font-semibold">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCompetitionId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Goal className="h-5 w-5 text-emerald-600" />
              Meilleurs buteurs {selectedCompetition ? `– ${selectedCompetition.nom}` : ''}
            </CardTitle>
            <CardDescription>
              Buts comptabilisés sur les matchs homologués de cette compétition
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scorersLoading ? (
              <div className="flex justify-center py-8">
                <InlineLoader size="lg" />
              </div>
            ) : scorers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun but homologué pour le moment dans cette compétition.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {scorers.map((s, i) => (
                  <Link
                    key={s._id}
                    href={`/admin/joueurs/${s.joueur._id}`}
                    className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
                        i === 0
                          ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400'
                          : i === 1
                            ? 'bg-slate-400/20 text-slate-600 dark:text-slate-300'
                            : i === 2
                              ? 'bg-amber-700/20 text-amber-700 dark:text-amber-500'
                              : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                      {s.joueur.photo ? (
                        <Image src={s.joueur.photo} alt={s.joueur.nom} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-bold text-muted-foreground">
                          {s.joueur.prenom?.[0]}
                          {s.joueur.nom?.[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {s.joueur.prenom} {s.joueur.nom}
                        {s.joueur.numeroMaillot && (
                          <span className="font-normal text-muted-foreground"> #{s.joueur.numeroMaillot}</span>
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {s.club?.logo && (
                          <span className="relative h-3.5 w-3.5 shrink-0">
                            <Image src={s.club.logo} alt="" fill className="object-contain" />
                          </span>
                        )}
                        <span className="truncate">{s.club?.nom || '—'}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                      {s.goals}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}



