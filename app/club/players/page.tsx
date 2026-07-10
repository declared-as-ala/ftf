'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Users, Search } from 'lucide-react';

interface Joueur {
  _id: string;
  nom: string;
  prenom: string;
  licence: string;
  position: string;
  numeroMaillot?: number;
  status: string;
}

export default function ClubPlayers() {
  const [joueurs, setJoueurs] = useState<Joueur[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('limit', '200');
    fetch(`/api/club/players?${params}`)
      .then((r) => r.json())
      .then((d) => { setJoueurs(d.joueurs); setTotal(d.total); })
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes Joueurs</h1>
          <p className="text-muted-foreground mt-1">{total} joueur(s) actif(s)</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un joueur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
          ))}
        </div>
      ) : joueurs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Users className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun joueur trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {joueurs.map((j) => (
            <Link key={j._id} href={`/club/players/${j._id}`}>
              <Card className="transition-colors hover:bg-accent cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {j.prenom} {j.nom}
                    </CardTitle>
                    {j.numeroMaillot && (
                      <span className="text-sm text-muted-foreground font-mono">#{j.numeroMaillot}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{j.position}</Badge>
                    <span>{j.licence}</span>
                    <Badge variant={j.status === 'ACTIVE' ? 'default' : 'secondary'} className="ml-auto">
                      {j.status}
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
