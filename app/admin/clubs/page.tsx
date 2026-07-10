'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FullPageLoader, InlineLoader } from '@/components/Loader';
import { LoadingButton } from '@/components/LoadingButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Club {
  _id: string;
  nom: string;
  logo?: string;
  stade: string;
  ville: string;
  couleurs: string[];
  fondation: number;
  emailOfficiel: string;
  description?: string;
  siteweb?: string;
  telephone?: string;
}

export default function AdminClubsPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);

  const [nom, setNom] = useState('');
  const [stade, setStade] = useState('');
  const [ville, setVille] = useState('');
  const [emailOfficiel, setEmailOfficiel] = useState('');
  const [fondation, setFondation] = useState('');
  const [couleurs, setCouleurs] = useState('');
  const [description, setDescription] = useState('');
  const [siteweb, setSiteweb] = useState('');
  const [telephone, setTelephone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/clubs', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Erreur lors du chargement des clubs');
        }
        const data = await res.json();
        setClubs(data);
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchClubs();
  }, []);

  const resetForm = () => {
    setEditingClub(null);
    setNom('');
    setStade('');
    setVille('');
    setEmailOfficiel('');
    setFondation('');
    setCouleurs('');
    setDescription('');
    setSiteweb('');
    setTelephone('');
    setLogoFile(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (club: Club) => {
    setEditingClub(club);
    setNom(club.nom);
    setStade(club.stade);
    setVille(club.ville);
    setEmailOfficiel(club.emailOfficiel);
    setFondation(club.fondation?.toString() ?? '');
    setCouleurs(club.couleurs?.join(', ') ?? '');
    setDescription(club.description || '');
    setSiteweb(club.siteweb || '');
    setTelephone(club.telephone || '');
    setLogoFile(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('nom', nom);
      formData.append('stade', stade);
      formData.append('ville', ville);
      formData.append('emailOfficiel', emailOfficiel);
      formData.append('fondation', fondation || '0');
      formData.append('couleurs', couleurs);
      formData.append('description', description);
      formData.append('siteweb', siteweb);
      formData.append('telephone', telephone);

      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const isEdit = !!editingClub;
      if (isEdit && editingClub) {
        formData.append('id', editingClub._id);
      }

      const res = await fetch('/api/admin/clubs', {
        method: isEdit ? 'PUT' : 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erreur lors de la sauvegarde du club');
      }

      const saved = await res.json();

      if (isEdit) {
        setClubs((prev) => prev.map((c) => (c._id === saved._id ? saved : c)));
        setSuccess('Club mis à jour avec succès');
      } else {
        setClubs((prev) => [saved, ...prev]);
        setSuccess('Club créé avec succès');
      }

      resetForm();
      setFormOpen(false);
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (club: Club) => {
    if (!window.confirm(`Supprimer le club "${club.nom}" ?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/clubs?id=${club._id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erreur lors de la suppression du club');
      }

      setClubs((prev) => prev.filter((c) => c._id !== club._id));
      setSuccess('Club supprimé avec succès');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            Gestion des Clubs
          </h1>
          <p className="text-muted-foreground mt-2">
            Créez, modifiez et supprimez les clubs de la fédération. Vous pouvez également
            téléverser un logo pour chaque club.
          </p>
        </div>

        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un club
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {formOpen && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>{editingClub ? 'Modifier un club' : 'Nouveau club'}</CardTitle>
            <CardDescription>
              {editingClub
                ? 'Mettez à jour les informations du club sélectionné.'
                : 'Renseignez les informations du nouveau club.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom du club</Label>
                  <Input
                    id="nom"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stade">Stade</Label>
                  <Input
                    id="stade"
                    value={stade}
                    onChange={(e) => setStade(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ville">Ville</Label>
                  <Input
                    id="ville"
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailOfficiel">Email officiel</Label>
                  <Input
                    id="emailOfficiel"
                    type="email"
                    value={emailOfficiel}
                    onChange={(e) => setEmailOfficiel(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fondation">Année de fondation</Label>
                  <Input
                    id="fondation"
                    type="number"
                    value={fondation}
                    onChange={(e) => setFondation(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="couleurs">Couleurs (séparées par des virgules)</Label>
                  <Input
                    id="couleurs"
                    placeholder="Bleu, Blanc, Rouge"
                    value={couleurs}
                    onChange={(e) => setCouleurs(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brève description du club"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siteweb">Site web</Label>
                  <Input
                    id="siteweb"
                    value={siteweb}
                    onChange={(e) => setSiteweb(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="+33 ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Logo du club</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setLogoFile(file ?? null);
                  }}
                />
                {editingClub?.logo && !logoFile && (
                  <p className="text-xs text-muted-foreground">
                    Logo actuel :
                    <span className="inline-flex items-center gap-2 ml-2">
                      <Image
                        src={editingClub.logo}
                        alt={editingClub.nom}
                        width={32}
                        height={32}
                        className="rounded border"
                      />
                    </span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setFormOpen(false);
                  }}
                  disabled={submitting}
                >
                  Annuler
                </Button>
                <LoadingButton
                  type="submit"
                  loading={submitting}
                  loadingText="Enregistrement..."
                >
                  {editingClub ? 'Mettre à jour' : 'Créer le club'}
                </LoadingButton>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Liste des clubs</CardTitle>
          <CardDescription>
            {loading ? (
              <span className="flex items-center gap-2">
                <InlineLoader size="sm" />
                Chargement...
              </span>
            ) : (
              `Total : ${clubs.length} club(s)`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <InlineLoader size="lg" />
            </div>
          ) : clubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun club pour le moment. Cliquez sur &quot;Ajouter un club&quot; pour commencer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logo</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Fondation</TableHead>
                    <TableHead>Couleurs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clubs.map((club) => (
                    <TableRow
                      key={club._id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => router.push(`/admin/clubs/${club._id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {club.logo ? (
                            <Image
                              src={club.logo}
                              alt={club.nom}
                              width={32}
                              height={32}
                              className="rounded border bg-white object-contain"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded border bg-muted text-xs">
                              {club.nom.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{club.nom}</TableCell>
                      <TableCell>{club.ville}</TableCell>
                      <TableCell>{club.emailOfficiel}</TableCell>
                      <TableCell>{club.fondation}</TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {club.couleurs?.join(', ')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => router.push(`/admin/clubs/${club._id}`)}
                            title="Voir les détails"
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => openEditForm(club)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleDelete(club)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
