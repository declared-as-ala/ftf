'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Plus, Clipboard, Check, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Saison {
  _id: string;
  nom: string;
  code: string;
  anneeDebut: number;
  anneeFin: number;
  dateDebut: string;
  dateFin: string;
  active: boolean;
  status: 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  isCurrent: boolean;
  competitions: string[];
}

export default function SaisonsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Saison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields
  const [nom, setNom] = useState('');
  const [anneeDebut, setAnneeDebut] = useState(new Date().getFullYear());
  const [anneeFin, setAnneeFin] = useState(new Date().getFullYear() + 1);
  const [dateDebut, setDateDebut] = useState(`${new Date().getFullYear()}-08-01`);
  const [dateFin, setDateFin] = useState(`${new Date().getFullYear() + 1}-06-30`);
  const [seuilCartons, setSeuilCartons] = useState(3);

  const fetchSeasons = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/seasons');
      if (res.ok) {
        const data = await res.json();
        setSeasons(data);
      }
    } catch (err) {
      console.error('Failed to fetch seasons:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  // Update dates automatically when years change
  useEffect(() => {
    setDateDebut(`${anneeDebut}-08-01`);
    setDateFin(`${anneeFin}-06-30`);
  }, [anneeDebut, anneeFin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          anneeDebut: Number(anneeDebut),
          anneeFin: Number(anneeFin),
          dateDebut: new Date(dateDebut).toISOString(),
          dateFin: new Date(dateFin).toISOString(),
          configuration: {
            seuilCartonsJaunes: Number(seuilCartons),
            suspensionCartonRouge: 1,
            suspensionStaff: 1,
          },
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        // Reset form
        setNom('');
        fetchSeasons();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Une erreur est survenue lors de la création');
      }
    } catch (err) {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSeasons = seasons.filter((s) =>
    s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: Column<Saison>[] = [
    {
      header: 'Nom de la saison',
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
      header: 'Années',
      cell: (item) => `${item.anneeDebut} - ${item.anneeFin}`,
    },
    {
      header: 'Dates',
      cell: (item) => (
        <span className="text-xs text-muted-foreground">
          {new Date(item.dateDebut).toLocaleDateString('fr-FR')} au{' '}
          {new Date(item.dateFin).toLocaleDateString('fr-FR')}
        </span>
      ),
    },
    {
      header: 'Statut',
      cell: (item) => <StatusBadge status={item.status} />,
    },
    {
      header: 'Saison active',
      cell: (item) =>
        item.isCurrent ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <Check className="h-3 w-3" /> Courante
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Non</span>
        ),
    },
    {
      header: 'Compétitions',
      cell: (item) => `${item.competitions?.length || 0} compétition(s)`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Saisons"
        description="Créez, gérez et configurez les saisons de football de la Fédération Tunisienne de Football."
      >
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Nouvelle Saison
        </button>
      </PageHeader>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Rechercher une saison par nom ou code..."
      />

      {filteredSeasons.length === 0 && !isLoading ? (
        <EmptyState
          title="Aucune saison trouvée"
          description="Créez votre première saison de football pour commencer à configurer des compétitions."
          icon={Clipboard}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredSeasons}
          isLoading={isLoading}
          onRowClick={(item) => router.push(`/admin/saisons/${item._id}`)}
        />
      )}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-background border rounded-lg shadow-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-foreground">Créer une nouvelle saison</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configurez les dates de début et de fin ainsi que le seuil par défaut d'avertissements.
              </p>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
                    {error}
                  </div>
                )}
                
                <div className="grid gap-2">
                  <Label htmlFor="nom">Nom de la saison</Label>
                  <Input
                    id="nom"
                    required
                    placeholder="Ex: Saison 2025-2026"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="anneeDebut">Année début</Label>
                    <Input
                      id="anneeDebut"
                      type="number"
                      min={2000}
                      max={2100}
                      required
                      value={anneeDebut}
                      onChange={(e) => setAnneeDebut(Number(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="anneeFin">Année fin</Label>
                    <Input
                      id="anneeFin"
                      type="number"
                      min={2000}
                      max={2100}
                      required
                      value={anneeFin}
                      onChange={(e) => setAnneeFin(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dateDebut">Date début officielle</Label>
                    <Input
                      id="dateDebut"
                      type="date"
                      required
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dateFin">Date fin officielle</Label>
                    <Input
                      id="dateFin"
                      type="date"
                      required
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2 border-t pt-4">
                  <Label htmlFor="seuilCartons" className="font-semibold">
                    Configuration Disciplinaire par défaut
                  </Label>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex-1">
                      <Label htmlFor="seuilCartons" className="text-xs text-muted-foreground">
                        Seuil cartons jaunes (suspension automatique)
                      </Label>
                      <Input
                        id="seuilCartons"
                        type="number"
                        min={1}
                        max={10}
                        required
                        value={seuilCartons}
                        onChange={(e) => setSeuilCartons(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 bg-muted/40 p-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer la saison'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
