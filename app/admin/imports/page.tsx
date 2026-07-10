'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Upload, Download, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface TemplateInfo {
  entity: string;
  filename: string;
  headers: string[];
}

interface PreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
  valid: boolean;
}

interface ImportProgress {
  entity: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

const entityLabels: Record<string, string> = {
  clubs: 'Clubs',
  players: 'Joueurs',
  fixtures: 'Calendrier',
  results: 'Résultats',
};

export default function AdminImports() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [entity, setEntity] = useState<string>('clubs');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/imports').then((r) => r.json()).then((d) => setTemplates(d.templates || []));
  }, []);

  const handleUpload = async (validateOnly: boolean) => {
    if (!file) return;
    setLoading(true);
    setPreview([]);
    setProgress(null);

    const form = new FormData();
    form.append('entity', entity);
    form.append('file', file);
    form.append('mode', validateOnly ? 'validate' : 'process');
    if (!validateOnly) form.append('allow', 'true');

    try {
      const res = await fetch('/api/admin/imports', { method: 'POST', body: form });
      const data = await res.json();
      if (validateOnly) {
        setPreview(data.preview || []);
        setTotalRows(data.totalRows || 0);
      } else {
        setProgress(data.result);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    window.open(`/api/admin/imports?entity=${entity}&download=template`, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Import CSV" description="Importez des données en masse" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>1. Choisir le type</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {templates.map((t) => (
                <button
                  key={t.entity}
                  onClick={() => { setEntity(t.entity); setPreview([]); setProgress(null); }}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    entity === t.entity ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
                  }`}
                >{entityLabels[t.entity] || t.entity}</button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>2. Télécharger le modèle</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {templates.find((t) => t.entity === entity)?.headers.join(', ')}
            </p>
            <Button onClick={downloadTemplate} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Modèle {entityLabels[entity]}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>3. Uploader le fichier CSV</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
          <div className="flex gap-3">
            <Button onClick={() => handleUpload(true)} disabled={!file || loading} className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Valider & Aperçu
            </Button>
            <Button onClick={() => handleUpload(false)} disabled={!file || loading || preview.length === 0} variant="default" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Confirmer l'import
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Aperçu ({totalRows} ligne(s))
              <Badge variant="secondary">{preview.filter((r) => r.valid).length} valide(s)</Badge>
              <Badge variant="destructive">{preview.filter((r) => !r.valid).length} erreur(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1 px-2">#</th>
                    <th className="text-left py-1 px-2">Statut</th>
                    {templates.find((t) => t.entity === entity)?.headers.map((h) => (
                      <th key={h} className="text-left py-1 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.rowNumber} className={`border-b ${row.valid ? '' : 'bg-red-50'}`}>
                      <td className="py-1 px-2 font-mono text-xs">{row.rowNumber}</td>
                      <td className="py-1 px-2">
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </td>
                      {templates.find((t) => t.entity === entity)?.headers.map((h) => (
                        <td key={h} className="py-1 px-2 text-xs">{row.raw[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.filter((r) => !r.valid).length > 0 && (
              <div className="mt-3 space-y-1">
                {preview.filter((r) => !r.valid).slice(0, 5).map((r) => (
                  <p key={r.rowNumber} className="text-xs text-red-600">
                    Ligne {r.rowNumber}: {r.errors.join('; ')}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Résultat de l'import
              {progress.errorRows === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{progress.totalRows}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50">
                <p className="text-2xl font-bold text-green-700">{progress.created}</p>
                <p className="text-xs text-green-600">Créés</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-2xl font-bold text-blue-700">{progress.updated}</p>
                <p className="text-xs text-blue-600">Mis à jour</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50">
                <p className="text-2xl font-bold text-red-700">{progress.errorRows}</p>
                <p className="text-xs text-red-600">Erreurs</p>
              </div>
            </div>
            {progress.errors.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {progress.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Ligne {e.row}: {e.message}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
