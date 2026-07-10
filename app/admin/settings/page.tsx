'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/PageHeader';


export default function AdminSettings() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" description="Configuration générale de la plateforme" />

      <div className="grid gap-6 md:grid-cols-2">
        {data?.org && (
          <Card>
            <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><span className="text-sm text-muted-foreground">Nom</span><p className="font-medium">{data.org.name}</p></div>
              <div><span className="text-sm text-muted-foreground">Code</span><p className="font-medium">{data.org.code}</p></div>
              <div><span className="text-sm text-muted-foreground">Type</span><p className="font-medium">{data.org.type}</p></div>
              <Badge variant={data.org.active ? 'default' : 'secondary'}>{data.org.active ? 'Active' : 'Inactive'}</Badge>
            </CardContent>
          </Card>
        )}

        {data?.currentSeason && (
          <Card>
            <CardHeader><CardTitle>Saison en cours</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><span className="text-sm text-muted-foreground">Saison</span><p className="font-medium">{data.currentSeason.nom}</p></div>
              <div><span className="text-sm text-muted-foreground">Période</span><p className="font-medium">{new Date(data.currentSeason.dateDebut).toLocaleDateString('fr-FR')} — {new Date(data.currentSeason.dateFin).toLocaleDateString('fr-FR')}</p></div>
              <Badge variant={data.currentSeason.status === 'ACTIVE' ? 'default' : 'secondary'}>{data.currentSeason.status}</Badge>
            </CardContent>
          </Card>
        )}
      </div>

      {data?.ruleSets && data.ruleSets.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Règles Disciplinaires ({data.ruleSets.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.ruleSets.map((rs: any) => (
                <div key={rs._id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{rs.name}</p>
                    <Badge variant={rs.active ? 'default' : 'secondary'}>{rs.active ? 'Actif' : 'Inactif'}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Seuil cartons jaunes: {rs.yellowCardThreshold} · Portée: {rs.suspensionScope || 'ALL_OFFICIAL_COMPETITIONS'}
                  </p>
                  {rs.description && <p className="text-xs text-muted-foreground mt-1">{rs.description}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
