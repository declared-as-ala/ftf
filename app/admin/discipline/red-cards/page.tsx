'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CardBadge } from '@/components/ui/CardBadge';
import { SuspensionBadge } from '@/components/ui/SuspensionBadge';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield } from 'lucide-react';

interface Suspension {
  _id: string;
  suspensionType: string;
  status: string;
  scope: string;
  matchesSuspended: number;
  matchesServed: number;
  matchesRemaining: number;
  joueurId: { _id: string; nom: string; prenom: string; numeroMaillot?: number };
  clubId: { _id: string; nom: string; code: string; logo?: string };
  sourceMatchId?: { _id: string; date: string; scoreHome: number; scoreAway: number; statut: string };
  createdAt: string;
  decisionReference?: string;
}

export default function RedCardsPage() {
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'PROVISIONAL' | 'ALL'>('PROVISIONAL');
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const limit = 50;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit), status: tab });
        const res = await fetch(`/api/admin/discipline/red-decisions?${params}`);
        const data = await res.json();
        setSuspensions(data.suspensions || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, tab]);

  const pendingSuspensions = suspensions.filter(s => s.status === 'PROVISIONAL');

  const columns = [
    {
      header: 'Joueur',
      accessorKey: 'joueurId' as const,
      cell: (s: Suspension) => `${s.joueurId?.prenom || ''} ${s.joueurId?.nom || ''}`,
    },
    {
      header: 'Club',
      accessorKey: 'clubId' as const,
      cell: (s: Suspension) => s.clubId?.nom || '',
    },
    {
      header: 'Type',
      accessorKey: 'suspensionType' as const,
      cell: (s: Suspension) => (
        <CardBadge type={s.suspensionType === 'RED_CARD_PROVISIONAL' ? 'DIRECT_RED' as any : 'SECOND_YELLOW_RED' as any} />
      ),
    },
    {
      header: 'Statut',
      accessorKey: 'status' as const,
      cell: (s: Suspension) => <SuspensionBadge status={s.status as any} />,
    },
    {
      header: 'Matchs',
      accessorKey: 'matchesSuspended' as const,
      cell: (s: Suspension) => s.status === 'PROVISIONAL' ? 'En attente' : `${s.matchesServed}/${s.matchesSuspended}`,
    },
    {
      header: 'Réf. Décision',
      accessorKey: 'decisionReference' as const,
      cell: (s: Suspension) => s.decisionReference || '—',
    },
    {
      header: 'Date',
      accessorKey: 'createdAt' as const,
      cell: (s: Suspension) => new Date(s.createdAt).toLocaleDateString('fr-TN'),
    },
    {
      header: '',
      accessorKey: '_id' as const,
      cell: (s: Suspension) => s.status === 'PROVISIONAL' ? (
        <button
          onClick={() => setDecidingId(s._id)}
          className="text-xs font-medium text-primary hover:underline"
        >
          Prendre décision
        </button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartons Rouges"
        description="Décisions disciplinaires pour les cartons rouges"
      />

      <div className="flex gap-2">
        <button
          onClick={() => { setTab('PROVISIONAL'); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'PROVISIONAL' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
          }`}
        >
          En attente de décision
        </button>
        <button
          onClick={() => { setTab('ALL'); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
          }`}
        >
          Tous
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <AlertTriangle className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      ) : suspensions.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          title="Aucune suspension pour carton rouge"
          description={tab === 'PROVISIONAL' ? 'Aucune décision en attente' : 'Aucune suspension enregistrée'}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={suspensions}
            pagination={{ page, limit, total, onPageChange: setPage }}
          />

          {decidingId && (
            <RedDecisionDialog
              suspensionId={decidingId}
              onClose={() => setDecidingId(null)}
              onDone={() => {
                setDecidingId(null);
                setPage(1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function RedDecisionDialog({
  suspensionId, onClose, onDone,
}: {
  suspensionId: string; onClose: () => void; onDone: () => void;
}) {
  const [totalMatches, setTotalMatches] = useState(1);
  const [matchesMissed, setMatchesMissed] = useState(0);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!reference.trim() || !reason.trim()) {
      setError('Référence et motif obligatoires');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/discipline/red-decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspensionId,
          totalMatches,
          matchesMissedPreDecision: matchesMissed,
          decisionReference: reference.trim(),
          decisionReason: reason.trim(),
          scope: 'ALL_COMPETITIONS',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de l\'enregistrement');
      }
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = Math.max(0, totalMatches - matchesMissed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>Enregistrer la décision disciplinaire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nombre de matchs de suspension</label>
            <input
              type="number"
              min={0}
              value={totalMatches}
              onChange={(e) => setTotalMatches(Math.max(0, Number(e.target.value)))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Matchs déjà purgés (avant décision)</label>
            <input
              type="number"
              min={0}
              value={matchesMissed}
              onChange={(e) => setMatchesMissed(Math.max(0, Number(e.target.value)))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Restant à purger : {remaining} match{remaining !== 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Référence de la décision</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ex: Décision n°2025-042"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Motif de la décision</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Détails de la décision..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : 'Enregistrer la décision'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
