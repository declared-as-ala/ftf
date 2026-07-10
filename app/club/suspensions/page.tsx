'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SuspensionBadge } from '@/components/ui/SuspensionBadge';
import { Shield, AlertTriangle } from 'lucide-react';

import type { SuspensionStatus, SuspensionType } from '@/lib/models/Suspension';

interface SuspensionItem {
  _id: string;
  suspensionType: SuspensionType;
  status: SuspensionStatus;
  matchesSuspended: number;
  matchesServed: number;
  matchesRemaining: number;
  scope: string;
  joueurId: { _id: string; nom: string; prenom: string; numeroMaillot?: number };
  sourceMatchId?: { _id: string; date: string; scoreHome: number; scoreAway: number };
  createdAt: string;
}

export default function ClubSuspensions() {
  const [suspensions, setSuspensions] = useState<SuspensionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    params.set('limit', '100');
    fetch(`/api/club/suspensions?${params}`)
      .then((r) => r.json())
      .then((d) => { setSuspensions(d.suspensions); setTotal(d.total); })
      .finally(() => setLoading(false));
  }, [filter]);

  const filters = ['', 'ACTIVE', 'PROVISIONAL', 'SERVED', 'CANCELLED'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suspensions</h1>
        <p className="text-muted-foreground mt-1">{total} suspension(s)</p>
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
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : suspensions.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12"><Shield className="h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">Aucune suspension</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {suspensions.map((s) => (
            <Card key={s._id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <SuspensionBadge status={s.status} type={s.suspensionType} />
                  </div>
                  <div>
                    <p className="font-medium">{s.joueurId?.prenom} {s.joueurId?.nom}</p>
                    <p className="text-sm text-muted-foreground">{s.suspensionType} — {s.scope}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{s.matchesServed}/{s.matchesSuspended}</p>
                    {s.matchesRemaining > 0 ? (
                      <Badge variant="destructive">{s.matchesRemaining} restant(s)</Badge>
                    ) : (
                      <Badge variant="default">Terminée</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
