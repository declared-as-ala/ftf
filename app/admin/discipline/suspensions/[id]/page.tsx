'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { SuspensionBadge } from '@/components/ui/SuspensionBadge';
import { CardBadge } from '@/components/ui/CardBadge';
import { AuditTimeline } from '@/components/ui/AuditTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, XCircle } from 'lucide-react';

export default function SuspensionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/discipline/suspensions/${id}`);
        if (!res.ok) { setLoading(false); return; }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Suspension" description="Chargement..." />
        <div className="flex items-center justify-center py-12">
          <Shield className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data || !data.suspension) {
    return (
      <div className="space-y-6">
        <PageHeader title="Suspension" description="Introuvable" />
        <p className="text-muted-foreground">Cette suspension n&apos;existe pas ou a été supprimée.</p>
      </div>
    );
  }

  const { suspension, ledger } = data;

  async function handleCancel() {
    if (!cancelReason || cancelReason.trim().length < 5) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/discipline/suspensions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: cancelReason }),
      });
      if (res.ok) {
        router.refresh();
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
      setShowCancel(false);
    }
  }

  const typeLabels: Record<string, string> = {
    YELLOW_ACCUMULATION: 'Accumulation de cartons jaunes',
    RED_CARD_PROVISIONAL: 'Carton rouge — provisoire',
    RED_CARD_FINAL: 'Carton rouge — décision finale',
    MANUAL: 'Décision manuelle',
  };

  const scopeLabels: Record<string, string> = {
    ALL_OFFICIAL_COMPETITIONS: 'Toutes compétitions officielles',
    ALL_COMPETITIONS: 'Toutes compétitions',
    SAME_COMPETITION: 'Même compétition',
    SAME_CATEGORY: 'Même catégorie',
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push('/admin/discipline/suspensions')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux suspensions
      </button>

      <PageHeader
        title={`${suspension.joueurId?.prenom || ''} ${suspension.joueurId?.nom || ''}`}
        description={`${suspension.clubId?.nom || ''} — ${typeLabels[suspension.suspensionType] || suspension.suspensionType}`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <SuspensionBadge status={suspension.status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {suspension.matchesServed}/{suspension.matchesSuspended}
            </p>
            <p className="text-xs text-muted-foreground">
              {suspension.matchesRemaining} match{suspension.matchesRemaining !== 1 ? 's' : ''} restant{suspension.matchesRemaining !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Périmètre</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{scopeLabels[suspension.scope] || suspension.scope}</p>
          </CardContent>
        </Card>
      </div>

      {suspension.status === 'PROVISIONAL' && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
              Suspension provisoire — En attente de décision disciplinaire
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Un carton rouge a été reçu. Le joueur reste suspendu jusqu&apos;à ce qu&apos;une décision
              soit enregistrée. Allez dans la section « Cartons Rouges » pour prendre une décision.
            </p>
          </CardContent>
        </Card>
      )}

      {suspension.decisionReference && (
        <Card>
          <CardHeader>
            <CardTitle>Décision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Référence</span>
              <span className="font-medium">{suspension.decisionReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date décision</span>
              <span>{suspension.decisionDate ? new Date(suspension.decisionDate).toLocaleDateString('fr-TN') : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Matchs purgés avant décision</span>
              <span>{suspension.matchesMissedPreDecision || 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Motif</span>
              <p className="mt-1 rounded bg-muted p-2">{suspension.decisionReason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {suspension.status !== 'CANCELLED' && suspension.status !== 'SERVED' && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowCancel(true)}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            Annuler la suspension
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registre de purge</CardTitle>
        </CardHeader>
        <CardContent>
          {!ledger || ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucun match traité pour cette suspension</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Match</th>
                    <th className="pb-2 font-medium">Compté</th>
                    <th className="pb-2 font-medium">Raison</th>
                    <th className="pb-2 font-medium">Avant</th>
                    <th className="pb-2 font-medium">Après</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry: any) => (
                    <tr key={entry._id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {entry.matchId ? (
                          <span className="text-xs">
                            {new Date(entry.matchId.date).toLocaleDateString('fr-TN')}
                            {' — '}
                            {entry.matchId.scoreHome}-{entry.matchId.scoreAway}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {entry.counted ? (
                          <span className="text-green-600 font-medium">Oui</span>
                        ) : (
                          <span className="text-muted-foreground">Non</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs">{entry.reason}</td>
                      <td className="py-2 pr-4">{entry.remainingBefore}</td>
                      <td className="py-2 pr-4">{entry.remainingAfter}</td>
                      <td className="py-2 text-xs">
                        {new Date(entry.processedAt).toLocaleDateString('fr-TN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowCancel(false); setCancelReason(''); }}>
          <div className="w-full max-w-md bg-background border rounded-lg shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">Annuler la suspension</h2>
              <button onClick={() => { setShowCancel(false); setCancelReason(''); }} className="rounded p-1 hover:bg-accent">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Cette action est irréversible et sera enregistrée dans le journal d&apos;audit.
              </p>
              <div>
                <label className="text-sm font-medium">Raison obligatoire</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Motif de l'annulation (min 5 caractères)..."
                  rows={3}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {cancelReason.trim().length > 0 && cancelReason.trim().length < 5 && (
                  <p className="text-xs text-red-600 mt-1">Minimum 5 caractères requis</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 bg-muted/40 p-4 border-t">
              <button
                onClick={() => { setShowCancel(false); setCancelReason(''); }}
                className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent"
              >
                Annuler
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling || cancelReason.trim().length < 5}
                className="px-4 py-2 text-sm font-medium text-white bg-destructive rounded-md hover:bg-destructive/90 disabled:opacity-50"
              >
                {cancelling ? 'Annulation...' : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
