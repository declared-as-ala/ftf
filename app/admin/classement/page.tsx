'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Trophy } from 'lucide-react';
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

export default function ClassementPage() {
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [standings, setStandings] = useState<StandingRow[]>([]);
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
    </div>
  );
}



