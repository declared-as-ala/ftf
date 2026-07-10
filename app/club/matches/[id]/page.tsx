'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

interface MatchDetail {
  _id: string;
  date: string;
  statut: string;
  scoreHome: number;
  scoreAway: number;
  stade: string;
  homeClubId: { _id: string; nom: string; logo: string };
  awayClubId: { _id: string; nom: string; logo: string };
  competitionId: { _id: string; nom: string };
  saisonId: { _id: string; nom: string };
  arbitrePrincipalId?: { _id: string; nom: string; prenom: string };
  evenements: any[];
  isOfficial: boolean;
  homologue: boolean;
}

export default function ClubMatchDetail() {
  const params = useParams();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/club/matches/${params.id}`)
      .then((r) => r.json())
      .then(setMatch)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <Skeleton className="h-96" />;
  if (!match) return <p className="text-muted-foreground">Match introuvable</p>;

  return (
    <div className="space-y-6">
      <Link href="/club/matches" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux matchs
      </Link>

      <Card>
        <CardHeader className="text-center">
          <p className="text-sm text-muted-foreground">{match.competitionId?.nom} — {match.saisonId?.nom}</p>
          <div className="flex items-center justify-center gap-8 mt-4">
            <div className="text-center">
              <p className="text-lg font-bold">{match.homeClubId?.nom}</p>
            </div>
            <div className="text-center">
              <span className="text-5xl font-bold font-mono">
                {match.statut === 'Terminé' ? `${match.scoreHome} - ${match.scoreAway}` : 'vs'}
              </span>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{match.awayClubId?.nom}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge variant={match.statut === 'Terminé' ? 'default' : 'secondary'}>{match.statut}</Badge>
            {match.isOfficial && <Badge variant="outline">Officiel</Badge>}
            {match.homologue && <Badge variant="default">Homologué</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-center">
          <div>
            <span className="text-sm text-muted-foreground">Date</span>
            <p className="font-medium">{new Date(match.date).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Stade</span>
            <p className="font-medium">{match.stade}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Arbitre</span>
            <p className="font-medium">{match.arbitrePrincipalId ? `${match.arbitrePrincipalId.prenom} ${match.arbitrePrincipalId.nom}` : '—'}</p>
          </div>
        </CardContent>
      </Card>

      {match.evenements && match.evenements.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Événements</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {match.evenements.map((ev, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
                  <span className="font-mono text-muted-foreground w-8">{ev.minute}&apos;</span>
                  <Badge variant="outline">{ev.type}</Badge>
                  <span>{ev.joueurId?.prenom} {ev.joueurId?.nom}</span>
                  {ev.equipe && <Badge variant="secondary">{ev.equipe === 'home' ? match.homeClubId?.nom : match.awayClubId?.nom}</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
