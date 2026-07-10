'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CardBadge } from '@/components/ui/CardBadge';
import { SuspensionBadge } from '@/components/ui/SuspensionBadge';
import { ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';

interface PlayerDetail {
  joueur: any;
  cards: any[];
  suspensions: any[];
}

export default function ClubPlayerDetail() {
  const params = useParams();
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/club/players/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <Skeleton className="h-96" />;
  if (!data) return <p className="text-muted-foreground">Joueur introuvable</p>;

  const { joueur, cards, suspensions } = data;

  return (
    <div className="space-y-6">
      <Link href="/club/players" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux joueurs
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">{joueur.prenom} {joueur.nom}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{joueur.position}</Badge>
                {joueur.numeroMaillot && <span className="text-sm text-muted-foreground">#{joueur.numeroMaillot}</span>}
                <Badge variant={joueur.status === 'ACTIVE' ? 'default' : 'secondary'}>{joueur.status}</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div><span className="text-sm text-muted-foreground">Licence</span><p className="font-medium">{joueur.licence}</p></div>
          <div><span className="text-sm text-muted-foreground">Nationalité</span><p className="font-medium">{joueur.nationalite}</p></div>
          <div><span className="text-sm text-muted-foreground">Date de naissance</span><p className="font-medium">{new Date(joueur.dateNaissance).toLocaleDateString('fr-FR')}</p></div>
        </CardContent>
      </Card>

      {suspensions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Suspensions</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suspensions.map((s: any) => (
                <div key={s._id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <SuspensionBadge status={s.status} type={s.suspensionType} />
                    <p className="text-sm text-muted-foreground mt-1">{s.matchesSuspended} match(s)</p>
                  </div>
                  <Badge variant="destructive">{s.matchesRemaining} restant(s)</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {cards.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Historique des Cartons</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cards.map((c: any) => (
                <div key={c._id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <CardBadge type={c.cardType} />
                    <div>
                      <p className="text-sm">{c.matchId?.statut ? `${c.matchId.scoreHome} - ${c.matchId.scoreAway}` : '—'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{c.accumulationStatus}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
