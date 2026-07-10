'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CardBadge } from '@/components/ui/CardBadge';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar } from '@/components/ui/FilterBar';
import { Shield, Search } from 'lucide-react';

interface Card {
  _id: string;
  cardType: 'YELLOW' | 'SECOND_YELLOW_RED' | 'DIRECT_RED';
  accumulationStatus: string;
  accumulationCount?: number;
  minute?: number;
  joueurId: { _id: string; nom: string; prenom: string; numeroMaillot?: number };
  clubId: { _id: string; nom: string; code: string; logo?: string };
  matchId: { _id: string; date: string; journee: number; scoreHome: number; scoreAway: number; statut: string };
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Actif',
  CONSUMED_BY_SUSPENSION: 'Consommé',
  CANCELLED: 'Annulé',
  CLEARED_AT_SEASON_END: 'Effacé (fin saison)',
  NOT_OFFICIAL: 'Non officiel',
};

export default function YellowCardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const limit = 50;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (statusFilter) params.set('accumulationStatus', statusFilter);

        const res = await fetch(`/api/admin/discipline/cards?${params}`);
        const data = await res.json();
        setCards(data.cards || []);
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
      cell: (c: Card) => (
        <div>
          <p className="font-medium">{c.joueurId?.prenom} {c.joueurId?.nom}</p>
          <p className="text-xs text-muted-foreground">N°{c.joueurId?.numeroMaillot || '—'}</p>
        </div>
      ),
    },
    {
      header: 'Club',
      accessorKey: 'clubId' as const,
      cell: (c: Card) => c.clubId?.nom || '',
    },
    {
      header: 'Carte',
      accessorKey: 'cardType' as const,
      cell: (c: Card) => <CardBadge type={c.cardType as any} />,
    },
    {
      header: 'Minute',
      accessorKey: 'minute' as const,
      cell: (c: Card) => c.minute != null ? `${c.minute}'` : '—',
    },
    {
      header: 'Compteur',
      accessorKey: 'accumulationCount' as const,
      cell: (c: Card) => c.accumulationCount != null ? String(c.accumulationCount) : '—',
    },
    {
      header: 'Statut',
      accessorKey: 'accumulationStatus' as const,
      cell: (c: Card) => (
        <StatusBadge status={c.accumulationStatus} />
      ),
    },
    {
      header: 'Date',
      accessorKey: 'createdAt' as const,
      cell: (c: Card) => new Date(c.createdAt).toLocaleDateString('fr-TN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartons Jaunes"
        description="Suivi des avertissements et accumulation par joueur"
      />

      <div className="flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="CONSUMED_BY_SUSPENSION">Consommés</option>
          <option value="CANCELLED">Annulés</option>
          <option value="CLEARED_AT_SEASON_END">Effacés (fin saison)</option>
          <option value="NOT_OFFICIAL">Non officiels</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Shield className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          title="Aucun carton"
          description="Aucun carton jaune enregistré pour cette saison"
        />
      ) : (
        <DataTable
          columns={columns}
          data={cards}
          pagination={{ page, limit, total, onPageChange: setPage }}
        />
      )}
    </div>
  );
}
