'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EligibilityBadge } from '@/components/ui/EligibilityBadge';
import { Clipboard } from 'lucide-react';

interface UpcomingMatch {
  _id: string;
  date: string;
  homeClubId: { _id: string; nom: string };
  awayClubId: { _id: string; nom: string };
  competitionId: { _id: string; nom: string };
}

interface PlayerEligibility {
  player: { _id: string; nom: string; prenom: string; numeroMaillot?: number };
  club: 'home' | 'away';
  available: boolean;
  atRisk: boolean;
  activeYellows: number;
  suspensions: any[];
}

interface EligibilityData {
  matchId: string;
  homeClubId: string;
  awayClubId: string;
  home: PlayerEligibility[];
  away: PlayerEligibility[];
}

export default function ClubEligibility() {
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingElig, setLoadingElig] = useState(false);

  useEffect(() => {
    fetch('/api/club/eligibility?limit=100')
      .then((r) => r.json())
      .then((d) => setUpcomingMatches(d.upcomingMatches || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMatch) return;
    setLoadingElig(true);
    fetch(`/api/club/eligibility?matchId=${selectedMatch}`)
      .then((r) => r.json())
      .then(setEligibility)
      .finally(() => setLoadingElig(false));
  }, [selectedMatch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Éligibilité des Joueurs</h1>
        <p className="text-muted-foreground mt-1">Consultez la disponibilité par match</p>
      </div>

      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <CardHeader><CardTitle>Sélectionner un match</CardTitle></CardHeader>
          <CardContent>
            <select
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
              className="w-full rounded-md border p-2 bg-background"
            >
              <option value="">— Choisir un match —</option>
              {upcomingMatches.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.homeClubId?.nom} vs {m.awayClubId?.nom} — {m.competitionId?.nom} ({new Date(m.date).toLocaleDateString('fr-FR')})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {loadingElig && <Skeleton className="h-64" />}

      {eligibility && !loadingElig && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Domicile
                <Badge variant="secondary">
                  {eligibility.home.filter((p) => p.available).length}/{eligibility.home.length} disponibles
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eligibility.home.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun joueur</p>
              ) : (
                <div className="space-y-2">
                  {eligibility.home.map((p) => (
                    <div key={p.player._id} className="flex items-center justify-between rounded-lg border p-2">
                      <div className="flex items-center gap-2">
                        <EligibilityBadge available={p.available} atRisk={p.atRisk} />
                        <span className="text-sm font-medium">{p.player.prenom} {p.player.nom}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{p.activeYellows} JA</span>
                        {p.suspensions.length > 0 && (
                          <Badge variant="destructive" className="text-xs">{p.suspensions.length} susp.</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Extérieur
                <Badge variant="secondary">
                  {eligibility.away.filter((p) => p.available).length}/{eligibility.away.length} disponibles
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eligibility.away.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun joueur</p>
              ) : (
                <div className="space-y-2">
                  {eligibility.away.map((p) => (
                    <div key={p.player._id} className="flex items-center justify-between rounded-lg border p-2">
                      <div className="flex items-center gap-2">
                        <EligibilityBadge available={p.available} atRisk={p.atRisk} />
                        <span className="text-sm font-medium">{p.player.prenom} {p.player.nom}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{p.activeYellows} JA</span>
                        {p.suspensions.length > 0 && (
                          <Badge variant="destructive" className="text-xs">{p.suspensions.length} susp.</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
