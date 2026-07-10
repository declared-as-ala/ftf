'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
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

interface ClubOption {
  _id: string;
  nom: string;
}

interface JoueurDto {
  _id: string;
  nom: string;
  prenom: string;
  licence: string;
  nationalite: string;
  position: 'Gardien' | 'Défenseur' | 'Milieu' | 'Attaquant';
  clubId: string | { _id: string; nom: string };
  dateNaissance: string;
  lieuNaissance?: string;
  photo?: string;
  numeroMaillot?: number;
  taille?: number;
  poids?: number;
  piedPrefere?: 'Gauche' | 'Droit' | 'Les deux';
}

export default function AdminJoueursPage() {
  const [joueurs, setJoueurs] = useState<JoueurDto[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JoueurDto | null>(null);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [licence, setLicence] = useState('');
  const [nationalite, setNationalite] = useState('');
  const [position, setPosition] = useState<'Gardien' | 'Défenseur' | 'Milieu' | 'Attaquant' | ''>('');
  const [clubId, setClubId] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [lieuNaissance, setLieuNaissance] = useState('');
  const [numeroMaillot, setNumeroMaillot] = useState('');
  const [taille, setTaille] = useState('');
  const [poids, setPoids] = useState('');
  const [piedPrefere, setPiedPrefere] = useState<'Gauche' | 'Droit' | 'Les deux' | ''>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [joueursRes, clubsRes] = await Promise.all([
          fetch('/api/admin/joueurs', { cache: 'no-store' }),
          fetch('/api/admin/clubs', { cache: 'no-store' }),
        ]);

        if (!joueursRes.ok) {
          throw new Error('Erreur lors du chargement des joueurs');
        }
        if (!clubsRes.ok) {
          throw new Error('Erreur lors du chargement des clubs');
        }

        const joueursData = await joueursRes.json();
        const clubsData = await clubsRes.json();

        setJoueurs(joueursData);
        setClubs(clubsData);
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setNom('');
    setPrenom('');
    setLicence('');
    setNationalite('');
    setPosition('');
    setClubId('');
    setDateNaissance('');
    setLieuNaissance('');
    setNumeroMaillot('');
    setTaille('');
    setPoids('');
    setPiedPrefere('');
    setPhotoFile(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (j: JoueurDto) => {
    setEditing(j);
    setNom(j.nom);
    setPrenom(j.prenom);
    setLicence(j.licence);
    setNationalite(j.nationalite);
    setPosition(j.position);
    const cid = typeof j.clubId === 'string' ? j.clubId : j.clubId?._id;
    setClubId(cid || '');
    if (j.dateNaissance) {
      const d = new Date(j.dateNaissance);
      const iso = d.toISOString().slice(0, 10);
      setDateNaissance(iso);
    } else {
      setDateNaissance('');
    }
    setLieuNaissance(j.lieuNaissance || '');
    setNumeroMaillot(j.numeroMaillot != null ? String(j.numeroMaillot) : '');
    setTaille(j.taille != null ? String(j.taille) : '');
    setPoids(j.poids != null ? String(j.poids) : '');
    setPiedPrefere(j.piedPrefere || '');
    setPhotoFile(null);
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
      formData.append('prenom', prenom);
      formData.append('licence', licence);
      formData.append('nationalite', nationalite);
      formData.append('position', position);
      formData.append('clubId', clubId);
      formData.append('dateNaissance', dateNaissance);
      formData.append('lieuNaissance', lieuNaissance);
      formData.append('numeroMaillot', numeroMaillot);
      formData.append('taille', taille);
      formData.append('poids', poids);
      formData.append('piedPrefere', piedPrefere);

      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const isEdit = !!editing;
      if (isEdit && editing) {
        formData.append('id', editing._id);
      }

      const res = await fetch('/api/admin/joueurs', {
        method: isEdit ? 'PUT' : 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erreur lors de la sauvegarde du joueur');
      }

      const saved = await res.json();

      if (isEdit) {
        setJoueurs((prev) => prev.map((j) => (j._id === saved._id ? saved : j)));
        setSuccess('Joueur mis à jour avec succès');
      } else {
        setJoueurs((prev) => [saved, ...prev]);
        setSuccess('Joueur créé avec succès');
      }

      resetForm();
      setFormOpen(false);
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (joueur: JoueurDto) => {
    if (!window.confirm(`Supprimer le joueur "${joueur.prenom} ${joueur.nom}" ?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/joueurs?id=${joueur._id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erreur lors de la suppression du joueur');
      }

      setJoueurs((prev) => prev.filter((j) => j._id !== joueur._id));
      setSuccess('Joueur supprimé avec succès');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    }
  };

  const getClubName = (player: JoueurDto) => {
    if (!player.clubId) return '-';
    if (typeof player.clubId === 'string') {
      const c = clubs.find((cl) => cl._id === player.clubId);
      return c?.nom || '-';
    }
    return player.clubId.nom;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-green-600" />
            Gestion des Joueurs
          </h1>
          <p className="text-muted-foreground mt-2">
            Créez, modifiez et supprimez les joueurs licenciés. Vous pouvez également téléverser
            une photo pour chaque joueur.
          </p>
        </div>

        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un joueur
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
            <CardTitle>{editing ? 'Modifier un joueur' : 'Nouveau joueur'}</CardTitle>
            <CardDescription>
              {editing
                ? 'Mettez à jour les informations du joueur sélectionné.'
                : 'Renseignez les informations du nouveau joueur.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom</Label>
                  <Input
                    id="prenom"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom</Label>
                  <Input
                    id="nom"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="licence">Numéro de licence</Label>
                  <Input
                    id="licence"
                    value={licence}
                    onChange={(e) => setLicence(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationalite">Nationalité</Label>
                  <Input
                    id="nationalite"
                    value={nationalite}
                    onChange={(e) => setNationalite(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Poste</Label>
                  <select
                    id="position"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={position}
                    onChange={(e) =>
                      setPosition(e.target.value as 'Gardien' | 'Défenseur' | 'Milieu' | 'Attaquant' | '')
                    }
                    required
                  >
                    <option value="">Sélectionner</option>
                    <option value="Gardien">Gardien</option>
                    <option value="Défenseur">Défenseur</option>
                    <option value="Milieu">Milieu</option>
                    <option value="Attaquant">Attaquant</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="clubId">Club</Label>
                  <select
                    id="clubId"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value)}
                    required
                  >
                    <option value="">Sélectionner un club</option>
                    {clubs.map((club) => (
                      <option key={club._id} value={club._id}>
                        {club.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateNaissance">Date de naissance</Label>
                  <Input
                    id="dateNaissance"
                    type="date"
                    value={dateNaissance}
                    onChange={(e) => setDateNaissance(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lieuNaissance">Lieu de naissance</Label>
                  <Input
                    id="lieuNaissance"
                    value={lieuNaissance}
                    onChange={(e) => setLieuNaissance(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="numeroMaillot">Numéro</Label>
                  <Input
                    id="numeroMaillot"
                    type="number"
                    value={numeroMaillot}
                    onChange={(e) => setNumeroMaillot(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taille">Taille (cm)</Label>
                  <Input
                    id="taille"
                    type="number"
                    value={taille}
                    onChange={(e) => setTaille(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poids">Poids (kg)</Label>
                  <Input
                    id="poids"
                    type="number"
                    value={poids}
                    onChange={(e) => setPoids(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="piedPrefere">Pied préféré</Label>
                  <select
                    id="piedPrefere"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={piedPrefere}
                    onChange={(e) =>
                      setPiedPrefere(e.target.value as 'Gauche' | 'Droit' | 'Les deux' | '')
                    }
                  >
                    <option value="">Non spécifié</option>
                    <option value="Gauche">Gauche</option>
                    <option value="Droit">Droit</option>
                    <option value="Les deux">Les deux</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Photo du joueur</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPhotoFile(file ?? null);
                  }}
                />
                {editing?.photo && !photoFile && (
                  <p className="text-xs text-muted-foreground">
                    Photo actuelle :
                    <span className="inline-flex items-center gap-2 ml-2">
                      <Image
                        src={editing.photo}
                        alt={`${editing.prenom} ${editing.nom}`}
                        width={32}
                        height={32}
                        className="rounded-full border bg-white object-cover"
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
                  {editing ? 'Mettre à jour' : 'Créer le joueur'}
                </LoadingButton>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Liste des joueurs</CardTitle>
          <CardDescription>
            {loading ? 'Chargement des joueurs...' : `Total : ${joueurs.length} joueur(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {joueurs.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              Aucun joueur pour le moment. Cliquez sur &quot;Ajouter un joueur&quot; pour commencer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {joueurs.map((j) => (
                    <TableRow key={j._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {j.photo ? (
                            <Image
                              src={j.photo}
                              alt={`${j.prenom} ${j.nom}`}
                              width={32}
                              height={32}
                              className="rounded-full border bg-white object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-xs">
                              {j.prenom.charAt(0).toUpperCase()}
                              {j.nom.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {j.prenom} {j.nom}
                      </TableCell>
                      <TableCell>{j.licence}</TableCell>
                      <TableCell>{getClubName(j)}</TableCell>
                      <TableCell>{j.position}</TableCell>
                      <TableCell>{j.numeroMaillot ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="outline" onClick={() => openEditForm(j)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleDelete(j)}
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



