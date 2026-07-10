'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Download } from 'lucide-react';

interface ReportMeta {
  type: string;
  label: string;
  description: string;
  forAdmin: boolean;
  forClub: boolean;
}

export default function AdminReports() {
  const [catalog, setCatalog] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/reports')
      .then((r) => r.json())
      .then((d) => setCatalog(d.catalog))
      .finally(() => setLoading(false));
  }, []);

  const generate = async (type: string) => {
    setGenerating(type);
    setResult(null);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, format: 'csv' }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        // Download CSV
        const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports"
        description="Générez des rapports CSV/Excel sur l'ensemble des données"
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.filter((r) => r.forAdmin).map((report) => (
            <Card key={report.type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{report.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                <Button
                  onClick={() => generate(report.type)}
                  disabled={generating === report.type}
                  className="w-full flex items-center gap-2"
                  variant="outline"
                >
                  <Download className="h-4 w-4" />
                  {generating === report.type ? 'Génération...' : 'Télécharger CSV'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {result && (
        <Card>
          <CardHeader><CardTitle>Rapport généré</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {result.count} ligne(s) exportée(s) — {result.filename}.csv
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
