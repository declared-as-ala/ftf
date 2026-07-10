'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CardBadge } from '@/components/ui/CardBadge';
import type { CardType } from '@/lib/models/DisciplinaryCard';
import { Shield } from 'lucide-react';

interface CardItem {
  _id: string;
  cardType: CardType;
  accumulationStatus: string;
  minute?: number;
  joueurId: { _id: string; nom: string; prenom: string; numeroMaillot?: number };
  matchId: { _id: string; date: string; scoreHome: number; scoreAway: number; statut: string };
  competitionId: { _id: string; nom: string };
  createdAt: string;
}

export default function ClubCards() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set('cardType', filter);
    params.set('limit', '200');
    fetch(`/api/club/cards?${params}`)
      .then((r) => r.json())
      .then((d) => { setCards(d.cards); setTotal(d.total); })
      .finally(() => setLoading(false));
  }, [filter]);

  const filters = ['', 'YELLOW', 'SECOND_YELLOW_RED', 'DIRECT_RED'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cartons Disciplinaires</h1>
        <p className="text-muted-foreground mt-1">{total} carton(s) cette saison</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!filter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>Tous</button>
        <button onClick={() => setFilter('YELLOW')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'YELLOW' ? 'bg-yellow-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>Jaunes</button>
        <button onClick={() => setFilter('SECOND_YELLOW_RED')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'SECOND_YELLOW_RED' ? 'bg-orange-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>Deuxième Jaune</button>
        <button onClick={() => setFilter('DIRECT_RED')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'DIRECT_RED' ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>Rouges</button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : cards.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12"><Shield className="h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">Aucun carton</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {cards.map((c) => (
            <Card key={c._id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <CardBadge type={c.cardType} />
                  <div>
                    <p className="font-medium">{c.joueurId?.prenom} {c.joueurId?.nom}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.competitionId?.nom} — {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.matchId && (
                    <span className="text-sm font-mono">
                      {c.matchId.scoreHome}-{c.matchId.scoreAway}
                    </span>
                  )}
                  <Badge variant="outline">{c.accumulationStatus}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
