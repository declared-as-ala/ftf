'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Shield } from 'lucide-react';

interface Anomaly {
  type: string;
  notes: string;
  joueurId: string;
  match: {
    _id: string;
    date: string;
    scoreHome: number;
    scoreAway: number;
    statut: string;
    homeClubId: { nom: string; code: string };
    awayClubId: { nom: string; code: string };
  };
  suspension: {
    _id: string;
    suspensionType: string;
    matchesRemaining: number;
    status: string;
    joueurId: { _id: string; nom: string; prenom: string; numeroMaillot?: number };
  };
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/discipline/anomalies?limit=100');
        const data = await res.json();
        setAnomalies(data.anomalies || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anomalies"
        description="Joueurs suspendus détectés dans des compositions de match"
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <AlertTriangle className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      ) : anomalies.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          title="Aucune anomalie"
          description="Aucun joueur suspendu n'a été détecté dans les compositions de match"
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{total} anomalie(s) détectée(s)</p>
          {anomalies.map((anomaly, idx) => (
            <Card key={idx} className="border-rose-300">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {anomaly.suspension.joueurId?.prenom} {anomaly.suspension.joueurId?.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Match : {anomaly.match.homeClubId?.nom} vs {anomaly.match.awayClubId?.nom}
                      {' — '}
                      {new Date(anomaly.match.date).toLocaleDateString('fr-TN')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Suspension {anomaly.suspension.suspensionType} — {anomaly.suspension.matchesRemaining} match(s) restant(s)
                    </p>
                    <p className="text-xs text-rose-600">{anomaly.notes}</p>
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
