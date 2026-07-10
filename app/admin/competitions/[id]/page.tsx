'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Trophy, 
  Users, 
  Shield, 
  ArrowLeft,
  Settings,
  ShieldAlert,
  Save,
  CheckSquare,
  Square,
  Calendar,
  Play,
  Clipboard
} from 'lucide-react';

interface Competition {
  _id: string;
  nom: string;
  code: string;
  type: string;
  niveau: string;
  active: boolean;
  status: string;
  isOfficial: boolean;
  formatCompetition: string;
  reglementPoints: {
    victoire: number;
    nul: number;
    defaite: number;
  };
  tieBreakers: string[];
  clubsParticipants: string[];
  disciplinaryRuleSetId?: {
    _id: string;
    name: string;
    version: number;
    yellowCardThreshold: number;
    yellowCardSuspensionMatches: number;
    suspensionScope: string;
  };
  saisonId?: {
    _id: string;
    nom: string;
  };
}

interface Club {
  _id: string;
  nom: string;
  code: string;
  ville: string;
  logo?: string;
}

interface Round {
  _id: string;
  number: number;
  name: string;
  dateDebut: string;
  dateFin: string;
  status: string;
  active: boolean;
  matchesCount?: number;
}

export default function CompetitionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState<'overview' | 'clubs' | 'rules' | 'rounds' | 'standings'>('overview');
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [registeredClubs, setRegisteredClubs] = useState<Club[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit form states
  const [editNom, setEditNom] = useState('');
  const [editType, setEditType] = useState('Championnat');
  const [editNiveau, setEditNiveau] = useState('National');
  const [editFormat, setEditFormat] = useState('Championnat');
  const [editPtsVictoire, setEditPtsVictoire] = useState(3);
  const [editPtsNul, setEditPtsNul] = useState(1);
  const [editPtsDefaite, setEditPtsDefaite] = useState(0);
  const [editStatus, setEditStatus] = useState('DRAFT');
  const [editIsOfficial, setEditIsOfficial] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Club enrollment states
  const [isClubModalOpen, setIsClubModalOpen] = useState(false);
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  const [isClubsSaving, setIsClubsSaving] = useState(false);
  const [clubsError, setClubsError] = useState('');

  // Calendar generation states
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [doubleLeg, setDoubleLeg] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const fetchCompetitionData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch competition details
      const compRes = await fetch(`/api/admin/competitions/${id}`);
      if (!compRes.ok) {
        throw new Error('Compétition introuvable');
      }
      const compData = await compRes.json();
      setCompetition(compData);

      // Seed edit form
      setEditNom(compData.nom);
      setEditType(compData.type);
      setEditNiveau(compData.niveau);
      setEditFormat(compData.formatCompetition || 'Championnat');
      setEditPtsVictoire(compData.reglementPoints?.victoire ?? 3);
      setEditPtsNul(compData.reglementPoints?.nul ?? 1);
      setEditPtsDefaite(compData.reglementPoints?.defaite ?? 0);
      setEditStatus(compData.status || 'DRAFT');
      setEditIsOfficial(compData.isOfficial ?? true);

      // Initialize selected clubs
      const activeClubIds = compData.clubsParticipants || [];
      setSelectedClubIds(activeClubIds);

      // 2. Fetch all clubs for enrollment
      const clubsRes = await fetch('/api/admin/clubs');
      if (clubsRes.ok) {
        const clubsData = await clubsRes.json();
        const clubsList = Array.isArray(clubsData) ? clubsData : clubsData.clubs || [];
        setAllClubs(clubsList);

        // Map registered clubs
        const registered = clubsList.filter((c: Club) => activeClubIds.includes(c._id));
        setRegisteredClubs(registered);
      }

      // 3. Fetch rounds/journées
      const roundsRes = await fetch(`/api/admin/rounds?competitionId=${id}`);
      if (roundsRes.ok) {
        const roundsData = await roundsRes.json();
        setRounds(roundsData);
      }
    } catch (err) {
      console.error(err);
      router.push('/admin/competitions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitionData();
  }, [id]);

  const handleUpdateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateError('');
    setUpdateSuccess(false);

    try {
      const res = await fetch(`/api/admin/competitions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: editNom,
          type: editType,
          niveau: editNiveau,
          formatCompetition: editFormat,
          reglementPoints: {
            victoire: Number(editPtsVictoire),
            nul: Number(editPtsNul),
            defaite: Number(editPtsDefaite),
          },
          status: editStatus,
          isOfficial: editIsOfficial,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCompetition(updated);
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

  const handleToggleClub = (clubId: string) => {
    setSelectedClubIds((prev) =>
      prev.includes(clubId) ? prev.filter((cid) => cid !== clubId) : [...prev, clubId]
    );
  };

  const handleSaveClubs = async () => {
    setIsClubsSaving(true);
    setClubsError('');

    try {
      const res = await fetch(`/api/admin/competitions/${id}/clubs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubIds: selectedClubIds }),
      });

      if (res.ok) {
        setIsClubModalOpen(false);
        fetchCompetitionData();
      } else {
        const err = await res.json();
        setClubsError(err.error || 'Erreur lors de l’inscription des clubs');
      }
    } catch (err) {
      setClubsError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsClubsSaving(false);
    }
  };

  const handleGenerateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenError('');

    try {
      const res = await fetch(`/api/admin/competitions/${id}/generate-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doubleLeg,
          startDate: new Date(startDate).toISOString(),
        }),
      });

      if (res.ok) {
        setIsGenModalOpen(false);
        fetchCompetitionData();
      } else {
        const err = await res.json();
        setGenError(err.error || 'Erreur lors de la génération du calendrier');
      }
    } catch (err) {
      setGenError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading || !competition) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-muted-foreground">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Chargement de la compétition...
      </div>
    );
  }

  const clubColumns: Column<Club>[] = [
    {
      header: 'Club',
      cell: (item) => (
        <div className="flex items-center gap-3">
          {item.logo ? (
            <img src={item.logo} alt={item.nom} className="h-8 w-8 rounded object-contain border bg-white" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground font-bold text-xs">
              {item.code}
            </div>
          )}
          <div>
            <span className="font-semibold text-foreground">{item.nom}</span>
            <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
              {item.code}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Ville',
      accessorKey: 'ville',
    },
  ];

  const roundColumns: Column<Round>[] = [
    {
      header: 'Nom de la journée',
      cell: (item) => <span className="font-semibold text-foreground">{item.name}</span>,
    },
    {
      header: 'Numéro',
      accessorKey: 'number',
    },
    {
      header: 'Période réglementaire',
      cell: (item) => (
        <span className="text-xs text-muted-foreground">
          du {new Date(item.dateDebut).toLocaleDateString('fr-FR')} au{' '}
          {new Date(item.dateFin).toLocaleDateString('fr-FR')}
        </span>
      ),
    },
    {
      header: 'Nombre de rencontres',
      cell: (item) => `${item.matchesCount || 0} match(s)`,
    },
    {
      header: 'Statut',
      cell: (item) => <StatusBadge status={item.status} />,
    },
  ];

  const completedRoundsCount = rounds.filter((r) => r.status === 'COMPLETED').length;
  const nextRound = rounds.find((r) => r.status !== 'COMPLETED')?.name || 'Aucune';

  return (
    <div className="space-y-6">
      <div 
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        onClick={() => router.push(competition.saisonId ? `/admin/saisons/${competition.saisonId._id}` : '/admin/competitions')}
      >
        <ArrowLeft className="h-4 w-4" /> 
        Retour à la saison {competition.saisonId?.nom || ''}
      </div>

      <PageHeader
        title={competition.nom}
        description={`Compétition Officielle · ${competition.type} · ${competition.niveau}`}
      >
        <StatusBadge status={competition.status} active={competition.active} />
      </PageHeader>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="h-4 w-4" /> Vue d'ensemble
        </button>
        <button
          onClick={() => setActiveTab('clubs')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'clubs'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" /> Clubs Engagés ({registeredClubs.length})
        </button>
        <button
          onClick={() => setActiveTab('rounds')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'rounds'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" /> Journées ({rounds.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'rules'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="h-4 w-4" /> Règlement Applicable
        </button>
        <button
          onClick={() => router.push(`/admin/competitions/${id}/standings`)}
          className="flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Trophy className="h-4 w-4" /> Classement
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuration de la Compétition</CardTitle>
                <CardDescription>Paramètres de classement, d'échelle de points et de format.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateCompetition} className="space-y-4">
                  {updateError && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
                      {updateError}
                    </div>
                  )}
                  {updateSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm p-3 rounded-md">
                      Configuration de la compétition enregistrée avec succès.
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="editNom">Nom officiel</Label>
                    <Input
                      id="editNom"
                      value={editNom}
                      onChange={(e) => setEditNom(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="editType">Type</Label>
                      <select
                        id="editType"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="Championnat">Championnat</option>
                        <option value="Coupe">Coupe</option>
                        <option value="Super Coupe">Super Coupe</option>
                        <option value="Tournoi">Tournoi</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="editNiveau">Niveau</Label>
                      <select
                        id="editNiveau"
                        value={editNiveau}
                        onChange={(e) => setEditNiveau(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="National">National</option>
                        <option value="Régional">Régional</option>
                        <option value="International">International</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="editStatus">Statut cycle de vie</Label>
                      <select
                        id="editStatus"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="DRAFT">Brouillon</option>
                        <option value="SCHEDULED">Programmé</option>
                        <option value="ACTIVE">Actif</option>
                        <option value="COMPLETED">Terminé</option>
                        <option value="ARCHIVED">Archivé</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="editFormat">Format de jeu</Label>
                      <select
                        id="editFormat"
                        value={editFormat}
                        onChange={(e) => setEditFormat(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="Championnat">Championnat</option>
                        <option value="Élimination Directe">Élimination Directe</option>
                        <option value="Groupes + Élimination">Groupes + Élimination</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <Label className="font-semibold">Barème des points attribués</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="editPtsVictoire">Victoire</Label>
                        <Input
                          id="editPtsVictoire"
                          type="number"
                          value={editPtsVictoire}
                          onChange={(e) => setEditPtsVictoire(Number(e.target.value))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="editPtsNul">Match Nul</Label>
                        <Input
                          id="editPtsNul"
                          type="number"
                          value={editPtsNul}
                          onChange={(e) => setEditPtsNul(Number(e.target.value))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="editPtsDefaite">Défaite</Label>
                        <Input
                          id="editPtsDefaite"
                          type="number"
                          value={editPtsDefaite}
                          onChange={(e) => setEditPtsDefaite(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" /> Enregistrer la configuration
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Départage (Tie-breakers)</CardTitle>
                <CardDescription>Critères de classement en cas d'égalité.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-foreground">
                <div className="flex items-center justify-between border-b pb-2">
                  <span>1. Points</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border font-mono">1er</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span>2. Différence de buts</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border font-mono">2ème</span>
                </div>
                <div className="flex items-center justify-between pb-2">
                  <span>3. Buts marqués</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border font-mono">3ème</span>
                </div>
                <div className="text-xs text-muted-foreground border-t pt-4">
                  Les critères de départage respectent les statuts généraux de la FTF.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'clubs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Clubs engagés dans la compétition</h2>
            <button
              onClick={() => setIsClubModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Gérer les Clubs ({registeredClubs.length})
            </button>
          </div>

          {registeredClubs.length === 0 ? (
            <EmptyState
              title="Aucun club engagé"
              description="Inscrivez les clubs participants à ce championnat ou cette coupe pour pouvoir planifier des matchs."
              icon={Users}
            />
          ) : (
            <DataTable
              columns={clubColumns}
              data={registeredClubs}
            />
          )}
        </div>
      )}

      {activeTab === 'rounds' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Journées (Calendrier)</h2>
            {rounds.length === 0 && registeredClubs.length >= 2 && (
              <button
                onClick={() => setIsGenModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                <Play className="h-4 w-4" /> Générer le Calendrier
              </button>
            )}
          </div>

          {rounds.length === 0 ? (
            <EmptyState
              title="Aucun calendrier généré"
              description={
                registeredClubs.length < 2
                  ? "Veuillez inscrire au moins 2 clubs dans l'onglet 'Clubs Engagés' avant de pouvoir générer le calendrier automatique des journées."
                  : "Le calendrier des journées de rencontres n'a pas encore été généré. Cliquez sur le bouton pour le créer automatiquement."
              }
              icon={Clipboard}
            >
              {registeredClubs.length >= 2 && (
                <button
                  onClick={() => setIsGenModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                >
                  Générer le Calendrier
                </button>
              )}
            </EmptyState>
          ) : (
            <div className="space-y-6">
              {/* KPIs indicators */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Total des Journées</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{rounds.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Journées Terminées</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {completedRoundsCount} / {rounds.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Prochaine Journée active</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-primary">{nextRound}</div>
                  </CardContent>
                </Card>
              </div>

              <DataTable
                columns={roundColumns}
                data={rounds}
                onRowClick={(item) => router.push(`/admin/competitions/${id}/rounds/${item._id}`)}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Règlement Disciplinaire Applicable</CardTitle>
                <CardDescription>Règles appliquées aux calculs de cartons de cette compétition.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {competition.disciplinaryRuleSetId ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b pb-4">
                      <Shield className="h-8 w-8 text-primary" />
                      <div>
                        <h3 className="font-bold text-foreground">{competition.disciplinaryRuleSetId.name}</h3>
                        <p className="text-xs text-muted-foreground">Version {competition.disciplinaryRuleSetId.version}.0 · Actif</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="border p-4 rounded-md">
                        <Label className="text-xs text-muted-foreground block">Seuil Cartons Jaunes</Label>
                        <span className="text-2xl font-bold text-foreground">{competition.disciplinaryRuleSetId.yellowCardThreshold}</span>
                        <p className="text-xs text-muted-foreground mt-1">Nombre d\'avertissements provoquant une suspension automatique.</p>
                      </div>
                      <div className="border p-4 rounded-md">
                        <Label className="text-xs text-muted-foreground block">Durée Suspension Jaunes</Label>
                        <span className="text-2xl font-bold text-foreground">{competition.disciplinaryRuleSetId.yellowCardSuspensionMatches} match(s)</span>
                        <p className="text-xs text-muted-foreground mt-1">Matchs fermes de suspension infligés.</p>
                      </div>
                    </div>

                    <div className="border p-4 rounded-md">
                      <Label className="text-xs text-muted-foreground block">Portée des Suspensions</Label>
                      <span className="text-sm font-semibold text-foreground">
                        {competition.disciplinaryRuleSetId.suspensionScope === 'ALL_OFFICIAL_COMPETITIONS'
                          ? 'Toutes les compétitions officielles de la FTF'
                          : 'Uniquement au sein de la même compétition'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Aucun règlement associé"
                    description="Cette compétition n'est rattachée à aucun règlement disciplinaire. Les avertissements ne génèreront pas de suspension."
                    icon={ShieldAlert}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Article 24 du Code</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Conformément aux directives de la FTF, les compétitions officielles partagent le règlement de discipline de leur saison parente. Tout changement de règlement s'applique à l'ensemble des compétitions qui y sont associées.
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Club Enrollment Modal */}
      {isClubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-background border rounded-lg shadow-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-foreground">Inscription des Clubs</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Sélectionnez les clubs de la fédération inscrits à cette compétition.
              </p>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
              {clubsError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md mb-4">
                  {clubsError}
                </div>
              )}

              {allClubs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun club disponible dans la base.</p>
              ) : (
                allClubs.map((club) => {
                  const isSelected = selectedClubIds.includes(club._id);
                  return (
                    <div
                      key={club._id}
                      onClick={() => handleToggleClub(club._id)}
                      className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {club.logo ? (
                          <img src={club.logo} alt={club.nom} className="h-8 w-8 rounded object-contain border bg-white" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground font-bold text-xs">
                            {club.code}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-foreground text-sm">{club.nom}</span>
                          <span className="ml-2 text-xs text-muted-foreground font-mono">({club.code})</span>
                        </div>
                      </div>
                      <div>
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 bg-muted/40 p-4 border-t">
              <button
                type="button"
                onClick={() => setIsClubModalOpen(false)}
                className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveClubs}
                disabled={isClubsSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isClubsSaving ? 'Enregistrement...' : 'Enregistrer l\'inscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Generation Modal */}
      {isGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-background border rounded-lg shadow-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-foreground">Générer le calendrier automatique</h2>
              <p className="text-xs text-muted-foreground mt-1">
                L\'algorithme va créer toutes les journées (rounds) et les rencontres correspondantes.
              </p>
            </div>

            <form onSubmit={handleGenerateCalendar}>
              <div className="p-6 space-y-4">
                {genError && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
                    {genError}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="startDate">Date de la première journée</Label>
                  <Input
                    id="startDate"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 border-t pt-4">
                  <input
                    id="doubleLeg"
                    type="checkbox"
                    checked={doubleLeg}
                    onChange={(e) => setDoubleLeg(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="doubleLeg" className="cursor-pointer select-none">
                    Championnat Aller-Retour (Double Leg)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Si décoché, un seul match sera programmé entre chaque équipe (Aller simple).
                </p>
              </div>

              <div className="flex justify-end gap-2 bg-muted/40 p-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsGenModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? 'Génération...' : 'Lancer la génération'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
