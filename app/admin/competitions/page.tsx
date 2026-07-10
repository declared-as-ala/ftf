'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Trophy } from 'lucide-react';

interface Competition {
  _id: string;
  nom: string;
  code: string;
  type: string;
  niveau: string;
  active: boolean;
  status: string;
  clubsParticipants: string[];
  saisonId?: {
    nom: string;
  };
}

export default function CompetitionsPage() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCompetitions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/competitions');
      if (res.ok) {
        const data = await res.json();
        setCompetitions(data);
      }
    } catch (err) {
      console.error('Failed to fetch competitions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const filteredCompetitions = competitions.filter((c) =>
    c.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: Column<Competition>[] = [
    {
      header: 'Nom de la compétition',
      cell: (item) => (
        <div>
          <span className="font-semibold text-foreground">{item.nom}</span>
          <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
            {item.code}
          </span>
        </div>
      ),
    },
    {
      header: 'Saison',
      cell: (item) => item.saisonId?.nom || 'Saison non spécifiée',
    },
    {
      header: 'Type',
      accessorKey: 'type',
    },
    {
      header: 'Niveau',
      accessorKey: 'niveau',
    },
    {
      header: 'Clubs participants',
      cell: (item) => `${item.clubsParticipants?.length || 0} club(s)`,
    },
    {
      header: 'Statut',
      cell: (item) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Compétitions"
        description="Consultez et configurez les compétitions officielles, tournois et championnats régionaux ou nationaux."
      />

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Rechercher une compétition par nom ou code..."
      />

      {filteredCompetitions.length === 0 && !isLoading ? (
        <EmptyState
          title="Aucune compétition trouvée"
          description="Les compétitions sont créées depuis l'onglet 'Compétitions' d'une saison spécifique."
          icon={Trophy}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredCompetitions}
          isLoading={isLoading}
          onRowClick={(item) => router.push(`/admin/competitions/${item._id}`)}
        />
      )}
    </div>
  );
}
