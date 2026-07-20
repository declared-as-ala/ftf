'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, UserRound } from 'lucide-react';

interface MatchItem {
  _id: string;
  date: string;
  statut: string;
  scoreHome: number;
  scoreAway: number;
  stade: string;
  homeClubId: { _id: string; nom: string; logo: string };
  awayClubId: { _id: string; nom: string; logo: string };
  competitionId: { _id: string; nom: string };
  publishedOfficials?: {
    publishedAt: string | null;
    referees: { displayName: string; role: string; categorie?: string }[];
  } | null;
}

export default function ClubMatches() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set('statut', filter);
    params.set('limit', '100');
    fetch(`/api/club/matches?${params}`)
      .then((r) => r.json())
      .then((d) => setMatches(d.matches))
      .finally(() => setLoading(false));
  }, [filter]);

  const filters = ['', 'Programmé', 'Terminé', 'Reporté', 'Annulé'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mes Matchs</h1>
        <p className="text-muted-foreground mt-1">Calendrier et résultats</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {f || 'Tous'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : matches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Calendar className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun match trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <Link key={m._id} href={`/club/matches/${m._id}`}>
              <Card className="transition-colors hover:bg-accent cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {m.homeClubId?.nom} vs {m.awayClubId?.nom}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {m.competitionId?.nom} — {new Date(m.date).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    {m.publishedOfficials && (() => {
                      const main = m.publishedOfficials!.referees.find((r) => r.role === 'MAIN');
                      return main ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <UserRound className="h-3 w-3" />
                          {main.displayName}
                        </p>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-3">
                    {m.statut === 'Terminé' && (
                      <span className="text-lg font-bold font-mono">{m.scoreHome} - {m.scoreAway}</span>
                    )}
                    <Badge variant={m.statut === 'Terminé' ? 'default' : m.statut === 'Programmé' ? 'secondary' : 'outline'}>
                      {m.statut}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
