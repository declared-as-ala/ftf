'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';

interface StandingRow {
  clubId: { _id: string; nom: string; logo: string };
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

interface StandingsDoc {
  _id: string;
  competitionId: { _id: string; nom: string; type: string };
  rows: StandingRow[];
  calculatedAt: string;
}

export default function ClubStandings() {
  const [standingsList, setStandingsList] = useState<StandingsDoc[]>([]);
  const [selectedComp, setSelectedComp] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/club/standings')
      .then((r) => r.json())
      .then((d) => {
        setStandingsList(d.standings || []);
        if (d.standings?.length > 0) setSelectedComp(d.standings[0].competitionId._id);
      })
      .finally(() => setLoading(false));
  }, []);

  const current = standingsList.find((s) => s.competitionId._id === selectedComp);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Classement</h1>
        <p className="text-muted-foreground mt-1">Position de votre club dans les compétitions</p>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : standingsList.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12"><BarChart3 className="h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">Aucun classement disponible</p></CardContent></Card>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {standingsList.map((s) => (
              <button
                key={s._id}
                onClick={() => setSelectedComp(s.competitionId._id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedComp === s.competitionId._id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {s.competitionId.nom}
              </button>
            ))}
          </div>

          {current && (
            <Card>
              <CardHeader>
                <CardTitle>{current.competitionId.nom}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-2">#</th>
                        <th className="text-left py-2">Club</th>
                        <th className="text-center py-2 px-2">J</th>
                        <th className="text-center py-2 px-2">G</th>
                        <th className="text-center py-2 px-2">N</th>
                        <th className="text-center py-2 px-2">P</th>
                        <th className="text-center py-2 px-2">BP</th>
                        <th className="text-center py-2 px-2">BC</th>
                        <th className="text-center py-2 px-2">Diff</th>
                        <th className="text-center py-2 px-2">Pts</th>
                        <th className="text-center py-2">Forme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.rows
                        .sort((a, b) => a.position - b.position)
                        .map((row) => (
                          <tr key={row.clubId._id} className="border-b last:border-0 hover:bg-accent/50">
                            <td className="py-2 pr-2 font-mono">{row.position}</td>
                            <td className="py-2 font-medium">{row.clubId.nom}</td>
                            <td className="py-2 text-center">{row.played}</td>
                            <td className="py-2 text-center text-green-600">{row.won}</td>
                            <td className="py-2 text-center text-muted-foreground">{row.drawn}</td>
                            <td className="py-2 text-center text-red-600">{row.lost}</td>
                            <td className="py-2 text-center">{row.goalsFor}</td>
                            <td className="py-2 text-center">{row.goalsAgainst}</td>
                            <td className={`py-2 text-center font-mono ${row.goalDifference > 0 ? 'text-green-600' : row.goalDifference < 0 ? 'text-red-600' : ''}`}>
                              {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
                            </td>
                            <td className="py-2 text-center font-bold">{row.points}</td>
                            <td className="py-2 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                {row.form.map((f, i) => (
                                  <span
                                    key={i}
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${
                                      f === 'W' ? 'bg-green-600' : f === 'D' ? 'bg-gray-400' : 'bg-red-600'
                                    }`}
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Mis à jour le {new Date(current.calculatedAt).toLocaleString('fr-FR')}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
