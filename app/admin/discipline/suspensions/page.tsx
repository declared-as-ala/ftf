'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { SuspensionBadge } from '@/components/ui/SuspensionBadge';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Clock } from 'lucide-react';

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
  createdAt: string;
  decisionReference?: string;
}

const typeLabels: Record<string, string> = {
  YELLOW_ACCUMULATION: 'Accumulation JA',
  RED_CARD_PROVISIONAL: 'Rouge provisoire',
  RED_CARD_FINAL: 'Rouge décision',
  MANUAL: 'Manuelle',
};

export default function SuspensionsPage() {
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const limit = 50;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(`/api/admin/discipline/suspensions?${params}`);
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
  }, [page, statusFilter]);

  const columns = [
    {
      header: 'Joueur',
      accessorKey: 'joueurId' as const,
      cell: (s: Suspension) => (
        <Link href={`/admin/discipline/suspensions/${s._id}`} className="font-medium hover:underline">
          {s.joueurId?.prenom} {s.joueurId?.nom}
        </Link>
      ),
    },
    {
      header: 'Club',
      accessorKey: 'clubId' as const,
      cell: (s: Suspension) => s.clubId?.nom || '',
    },
    {
      header: 'Type',
      accessorKey: 'suspensionType' as const,
      cell: (s: Suspension) => typeLabels[s.suspensionType] || s.suspensionType,
    },
    {
      header: 'Statut',
      accessorKey: 'status' as const,
      cell: (s: Suspension) => <SuspensionBadge status={s.status as any} />,
    },
    {
      header: 'Matchs',
      accessorKey: 'matchesSuspended' as const,
      cell: (s: Suspension) => `${s.matchesServed}/${s.matchesSuspended}`,
    },
    {
      header: 'Restants',
      accessorKey: 'matchesRemaining' as const,
      cell: (s: Suspension) => String(s.matchesRemaining),
    },
    {
      header: 'Date',
      accessorKey: 'createdAt' as const,
      cell: (s: Suspension) => new Date(s.createdAt).toLocaleDateString('fr-TN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suspensions"
        description="Gestion des suspensions et suivi par joueur"
      />

      <div className="flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="PROVISIONAL">Provisoire</option>
          <option value="ACTIVE">Active</option>
          <option value="SERVED">Purgée</option>
          <option value="CANCELLED">Annulée</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Clock className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      ) : suspensions.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-12 w-12" />}
          title="Aucune suspension"
          description="Aucune suspension enregistrée"
        />
      ) : (
        <DataTable
          columns={columns}
          data={suspensions}
          pagination={{ page, limit, total, onPageChange: setPage }}
        />
      )}
    </div>
  );
}
