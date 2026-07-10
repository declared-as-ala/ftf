'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Trophy, 
  Settings, 
  Shield, 
  Calendar, 
  Archive, 
  CheckCircle, 
  ArrowLeft,
  Plus,
  Play
} from 'lucide-react';

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
  configuration: {
    seuilCartonsJaunes: number;
    suspensionCartonRouge: number;
    suspensionStaff: number;
  };
}

interface Competition {
  _id: string;
  nom: string;
  code: string;
  type: string;
  niveau: string;
  active: boolean;
  status: string;
  clubsParticipants: string[];
}

interface RuleSet {
  _id: string;
  name: string;
  version: number;
  yellowCardThreshold: number;
  yellowCardSuspensionMatches: number;
  yellowCardsCountOnlyOfficialMatches: boolean;
  clearUnusedYellowCardsAtSeasonEnd: boolean;
  redCardCreatesProvisionalSuspension: boolean;
  suspensionScope: string;
  friendlyMatchesCount: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
}

export default function SaisonDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState<'overview' | 'competitions' | 'rules'>('overview');
  const [saison, setSaison] = useState<Saison | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [ruleset, setRuleset] = useState<RuleSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vue d'ensemble Edit states
  const [editNom, setEditNom] = useState('');
  const [editAnneeDebut, setEditAnneeDebut] = useState(2024);
  const [editAnneeFin, setEditAnneeFin] = useState(2025);
  const [editDateDebut, setEditDateDebut] = useState('');
  const [editDateFin, setEditDateFin] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // New Competition modal states
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [compNom, setCompNom] = useState('');
  const [compType, setCompType] = useState('Championnat');
  const [compNiveau, setCompNiveau] = useState('National');
  const [isCompSubmitting, setIsCompSubmitting] = useState(false);
  const [compError, setCompError] = useState('');

  // Ruleset Edit states
  const [rulesYellowThreshold, setRulesYellowThreshold] = useState(3);
  const [rulesYellowSuspMatches, setRulesYellowSuspMatches] = useState(1);
  const [rulesSuspScope, setRulesSuspScope] = useState('ALL_OFFICIAL_COMPETITIONS');
  const [isRulesUpdating, setIsRulesUpdating] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [rulesSuccess, setRulesSuccess] = useState(false);

  // Confirmation dialog states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'complete' | 'archive' | null>(null);
  const [isActionRunning, setIsActionRunning] = useState(false);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Season details
      const seasonRes = await fetch(`/api/admin/seasons/${id}`);
      if (!seasonRes.ok) {
        throw new Error('Saison introuvable');
      }
      const seasonData = await seasonRes.json();
      setSaison(seasonData);
      
      // Seed edit form
      setEditNom(seasonData.nom);
      setEditAnneeDebut(seasonData.anneeDebut);
      setEditAnneeFin(seasonData.anneeFin);
      setEditDateDebut(seasonData.dateDebut ? new Date(seasonData.dateDebut).toISOString().split('T')[0] : '');
      setEditDateFin(seasonData.dateFin ? new Date(seasonData.dateFin).toISOString().split('T')[0] : '');

      // 2. Fetch Season Competitions
      const compsRes = await fetch(`/api/admin/competitions?seasonId=${id}`);
      if (compsRes.ok) {
        const compsData = await compsRes.json();
        setCompetitions(compsData);
      }

      // 3. Fetch Disciplinary Ruleset for Season
      const rulesRes = await fetch(`/api/admin/rulesets?seasonId=${id}`);
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        // Rulesets API returns an array, pick the active/v1 one
        const activeSet = rulesData.find((r: RuleSet) => r.active) || rulesData[0] || null;
        setRuleset(activeSet);
        if (activeSet) {
          setRulesYellowThreshold(activeSet.yellowCardThreshold);
          setRulesYellowSuspMatches(activeSet.yellowCardSuspensionMatches);
          setRulesSuspScope(activeSet.suspensionScope);
        }
      }
    } catch (err) {
      console.error(err);
      router.push('/admin/saisons');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [id]);

  const handleUpdateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateError('');
    setUpdateSuccess(false);

    try {
      const res = await fetch(`/api/admin/seasons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: editNom,
          anneeDebut: Number(editAnneeDebut),
          anneeFin: Number(editAnneeFin),
          dateDebut: new Date(editDateDebut).toISOString(),
          dateFin: new Date(editDateFin).toISOString(),
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSaison(updated);
        setUpdateSuccess(true);
      } else {
        const err = await res.json();
        setUpdateError(err.error || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      setUpdateError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    setIsActionRunning(true);

    try {
      const res = await fetch(`/api/admin/seasons/${id}/${confirmAction}`, {
        method: 'POST',
      });

      if (res.ok) {
        const updated = await res.json();
        setSaison(updated);
        fetchAllData();
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setIsActionRunning(false);
      setConfirmOpen(false);
      setConfirmAction(null);
    }
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCompSubmitting(true);
    setCompError('');

    try {
      const res = await fetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: compNom,
          type: compType,
          niveau: compNiveau,
          saisonId: id,
        }),
      });

      if (res.ok) {
        setIsCompModalOpen(false);
        setCompNom('');
        // Refresh competitions
        const compsRes = await fetch(`/api/admin/competitions?seasonId=${id}`);
        if (compsRes.ok) {
          setCompetitions(await compsRes.ok ? await compsRes.json() : competitions);
        }
        fetchAllData();
      } else {
        const err = await res.json();
        setCompError(err.error || 'Erreur lors de la création de la compétition');
      }
    } catch (err) {
      setCompError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsCompSubmitting(false);
    }
  };

  const handleUpdateRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleset) return;
    setIsRulesUpdating(true);
    setRulesError('');
    setRulesSuccess(false);

    try {
      const res = await fetch(`/api/admin/rulesets/${ruleset._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yellowCardThreshold: Number(rulesYellowThreshold),
          yellowCardSuspensionMatches: Number(rulesYellowSuspMatches),
          suspensionScope: rulesSuspScope,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRuleset(updated);
        setRulesSuccess(true);
      } else {
        const err = await res.json();
        setRulesError(err.error || 'Erreur lors de la mise à jour des règles');
      }
    } catch (err) {
      setRulesError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsRulesUpdating(false);
    }
  };

  if (isLoading || !saison) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-muted-foreground">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Chargement de la saison...
      </div>
    );
  }

  const compColumns: Column<Competition>[] = [
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
      header: 'Type',
      accessorKey: 'type',
    },
    {
      header: 'Niveau',
      accessorKey: 'niveau',
    },
    {
      header: 'Clubs inscrits',
      cell: (item) => `${item.clubsParticipants?.length || 0} club(s)`,
    },
    {
      header: 'Statut',
      cell: (item) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors" onClick={() => router.push('/admin/saisons')}>
        <ArrowLeft className="h-4 w-4" /> Retour à la liste des saisons
      </div>

      <PageHeader
        title={saison.nom}
        description={`Saison Officielle FTF · ${saison.anneeDebut}-${saison.anneeFin}`}
      >
        <StatusBadge status={saison.status} active={saison.active} />
      </PageHeader>

      {/* Tabs Layout */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" /> Vue d'ensemble
        </button>
        <button
          onClick={() => setActiveTab('competitions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'competitions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="h-4 w-4" /> Compétitions ({competitions.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'rules'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="h-4 w-4" /> Règlement Disciplinaire
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main settings and actions */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Détails et Dates Officielles</CardTitle>
                <CardDescription>Modifiez les informations d'identification et la période réglementaire.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateSeason} className="space-y-4">
                  {updateError && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
                      {updateError}
                    </div>
                  )}
                  {updateSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm p-3 rounded-md">
                      Informations enregistrées avec succès.
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="editNom">Nom de la saison</Label>
                    <Input
                      id="editNom"
                      value={editNom}
                      onChange={(e) => setEditNom(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="editAnneeDebut">Année début</Label>
                      <Input
                        id="editAnneeDebut"
                        type="number"
                        value={editAnneeDebut}
                        onChange={(e) => setEditAnneeDebut(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="editAnneeFin">Année fin</Label>
                      <Input
                        id="editAnneeFin"
                        type="number"
                        value={editAnneeFin}
                        onChange={(e) => setEditAnneeFin(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="editDateDebut">Date début officielle</Label>
                      <Input
                        id="editDateDebut"
                        type="date"
                        value={editDateDebut}
                        onChange={(e) => setEditDateDebut(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="editDateFin">Date fin officielle</Label>
                      <Input
                        id="editDateFin"
                        type="date"
                        value={editDateFin}
                        onChange={(e) => setEditDateFin(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Enregistrer les modifications
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions de Cycle de Vie</CardTitle>
                <CardDescription>Pilotez l'activation ou la clôture réglementaire de la saison.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {saison.status === 'DRAFT' && (
                  <button
                    onClick={() => {
                      setConfirmAction('activate');
                      setConfirmOpen(true);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600/90 transition-colors"
                  >
                    <Play className="h-4 w-4" /> Activer et Rendre Courante
                  </button>
                )}

                {saison.status === 'ACTIVE' && (
                  <button
                    onClick={() => {
                      setConfirmAction('complete');
                      setConfirmOpen(true);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500/90 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" /> Clôturer la saison
                  </button>
                )}

                {(saison.status === 'ACTIVE' || saison.status === 'COMPLETED') && (
                  <button
                    onClick={() => {
                      setConfirmAction('archive');
                      setConfirmOpen(true);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-600/90 transition-colors"
                  >
                    <Archive className="h-4 w-4" /> Archiver la saison
                  </button>
                )}

                {(saison.status === 'COMPLETED') && (
                  <button
                    onClick={async () => {
                      if (!confirm('Effacer les cartons jaunes actifs de cette saison ? Cette action est irréversible et sera enregistrée dans le journal d\'audit.')) return;
                      try {
                        const res = await fetch(`/api/admin/seasons/${id}/clear-cards`, { method: 'POST' });
                        if (res.ok) {
                          alert('Cartons jaunes effacés avec succès.');
                          fetchAllData();
                        } else {
                          const err = await res.json();
                          alert(err.error || 'Erreur lors de l\'effacement');
                        }
                      } catch (err) {
                        alert('Erreur réseau');
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-yellow-600/90 transition-colors"
                  >
                    <Shield className="h-4 w-4" /> Effacer les cartons jaunes (fin de saison)
                  </button>
                )}

                <div className="text-xs text-muted-foreground border-t pt-4 space-y-1">
                  <p><strong>Note :</strong> L'activation d'une saison désactive et décoche automatiquement la saison courante précédente.</p>
                  <p>La clôture archive les cartons inutilisés et suspend les calculs dynamiques de discipline active.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'competitions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Compétitions configurées</h2>
            <button
              onClick={() => setIsCompModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> Nouvelle Compétition
            </button>
          </div>

          {competitions.length === 0 ? (
            <EmptyState
              title="Aucune compétition dans cette saison"
              description="Créez votre première compétition officielle (Ligue 1, Coupe de Tunisie, etc.) pour inscrire des clubs."
              icon={Trophy}
            />
          ) : (
            <DataTable
              columns={compColumns}
              data={competitions}
              onRowClick={(item) => router.push(`/admin/competitions/${item._id}`)}
            />
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres Disciplinaires Actifs</CardTitle>
                <CardDescription>
                  Configuration réglementaire du barème de sanctions pour cette saison.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ruleset ? (
                  <form onSubmit={handleUpdateRules} className="space-y-4">
                    {rulesError && (
                      <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
                        {rulesError}
                      </div>
                    )}
                    {rulesSuccess && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm p-3 rounded-md">
                        Règlement mis à jour avec succès.
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="rulesYellowThreshold">Seuil cartons jaunes (suspension d'un match)</Label>
                      <Input
                        id="rulesYellowThreshold"
                        type="number"
                        min={1}
                        value={rulesYellowThreshold}
                        onChange={(e) => setRulesYellowThreshold(Number(e.target.value))}
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="rulesYellowSuspMatches">Nombre de matchs de suspension infligés</Label>
                      <Input
                        id="rulesYellowSuspMatches"
                        type="number"
                        min={1}
                        value={rulesYellowSuspMatches}
                        onChange={(e) => setRulesYellowSuspMatches(Number(e.target.value))}
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="rulesSuspScope">Portée de la suspension automatique</Label>
                      <select
                        id="rulesSuspScope"
                        value={rulesSuspScope}
                        onChange={(e) => setRulesSuspScope(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="ALL_OFFICIAL_COMPETITIONS">Toutes les compétitions officielles</option>
                        <option value="SAME_COMPETITION">Uniquement la même compétition</option>
                        <option value="ALL_MATCHES">Tous les matchs (y compris amicaux)</option>
                      </select>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isRulesUpdating}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        Enregistrer le règlement
                      </button>
                    </div>
                  </form>
                ) : (
                  <EmptyState
                    title="Aucun règlement trouvé"
                    description="Une anomalie s'est produite : aucun règlement n'est actif pour cette saison."
                    icon={Shield}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>À propos des Règlements</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p><strong>Version Actuelle :</strong> v1.0</p>
                <p>Les règles disciplinaires sont liées de manière immuable aux compétitions. Toute modification s'applique instantanément aux futurs calculs de suspension mais ne réévalue pas rétroactivement les sanctions déjà prononcées.</p>
                <p>En conformité avec l'Article 24 du Code Disciplinaire FTF.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleAction}
        title={
          confirmAction === 'activate'
            ? 'Activer la saison courante ?'
            : confirmAction === 'complete'
            ? 'Clôturer officiellement la saison ?'
            : 'Archiver la saison ?'
        }
        description={
          confirmAction === 'activate'
            ? 'Cette action activera cette saison et désactivera toutes les autres saisons courantes. Les calculs de discipline et les matchs en cours y seront rattachés.'
            : confirmAction === 'complete'
            ? 'La clôture fige la saison. Aucun nouveau match ne pourra être joué et les avertissements restants seront archivés.'
            : 'L\'archivage masque la saison dans les workspaces actifs et la transfère aux archives historiques.'
        }
        confirmText={
          confirmAction === 'activate'
            ? 'Activer la saison'
            : confirmAction === 'complete'
            ? 'Clôturer la saison'
            : 'Archiver la saison'
        }
        destructive={confirmAction !== 'activate'}
      />

      {/* Competition Creation Modal */}
      {isCompModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-background border rounded-lg shadow-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-foreground">Créer une compétition</h2>
              <p className="text-xs text-muted-foreground mt-1">
                La compétition sera créée et rattachée à la saison {saison.nom}.
              </p>
            </div>

            <form onSubmit={handleCreateCompetition}>
              <div className="p-6 space-y-4">
                {compError && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
                    {compError}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="compNom">Nom de la compétition</Label>
                  <Input
                    id="compNom"
                    required
                    placeholder="Ex: Ligue 1 Professionnelle"
                    value={compNom}
                    onChange={(e) => setCompNom(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="compType">Type de compétition</Label>
                  <select
                    id="compType"
                    value={compType}
                    onChange={(e) => setCompType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="Championnat">Championnat</option>
                    <option value="Coupe">Coupe</option>
                    <option value="Super Coupe">Super Coupe</option>
                    <option value="Tournoi">Tournoi</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="compNiveau">Niveau</Label>
                  <select
                    id="compNiveau"
                    value={compNiveau}
                    onChange={(e) => setCompNiveau(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="National">National</option>
                    <option value="Régional">Régional</option>
                    <option value="International">International</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 bg-muted/40 p-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsCompModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCompSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isCompSubmitting ? 'Création...' : 'Créer la compétition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
