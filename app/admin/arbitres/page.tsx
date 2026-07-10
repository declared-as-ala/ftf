'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Flag, Plus, Pencil, Trash2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type ArbitreCategorie = 'Élite' | 'Première Division' | 'Deuxième Division' | 'Régional';

interface ArbitreDto {
  _id: string;
  nom: string;
  prenom: string;
  categorie: ArbitreCategorie;
  dateNaissance: string;
  nationalite: string;
  photo?: string;
  email?: string;
  telephone?: string;
  ville: string;
  actif: boolean;
}

export default function AdminArbitresPage() {
  const [arbitres, setArbitres] = useState<ArbitreDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ArbitreDto | null>(null);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [categorie, setCategorie] = useState<ArbitreCategorie | ''>('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [nationalite, setNationalite] = useState('');
  const [ville, setVille] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [actif, setActif] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchArbitres = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/arbitres', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Erreur lors du chargement des arbitres');
        }
        const data = await res.json();
        setArbitres(data);
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchArbitres();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setNom('');
    setPrenom('');
    setCategorie('');
    setDateNaissance('');
    setNationalite('');
    setVille('');
    setEmail('');
    setTelephone('');
    setActif(true);
    setPhotoFile(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (a: ArbitreDto) => {
    setEditing(a);
    setNom(a.nom);
    setPrenom(a.prenom);
    setCategorie(a.categorie);
    if (a.dateNaissance) {
      const d = new Date(a.dateNaissance);
      setDateNaissance(d.toISOString().slice(0, 10));
    } else {
      setDateNaissance('');
    }
    setNationalite(a.nationalite);
    setVille(a.ville);
    setEmail(a.email || '');
    setTelephone(a.telephone || '');
    setActif(a.actif);
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
      formData.append('categorie', categorie);
      formData.append('dateNaissance', dateNaissance);
      formData.append('nationalite', nationalite);
      formData.append('ville', ville);
      formData.append('email', email);
      formData.append('telephone', telephone);
      formData.append('actif', actif ? 'true' : 'false');

      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const isEdit = !!editing;
      if (isEdit && editing) {
        formData.append('id', editing._id);
      }

      const res = await fetch('/api/admin/arbitres', {
        method: isEdit ? 'PUT' : 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erreur lors de la sauvegarde de l’arbitre');
      }

      const saved = await res.json();

      if (isEdit) {
        setArbitres((prev) => prev.map((a) => (a._id === saved._id ? saved : a)));
        setSuccess('Arbitre mis à jour avec succès');
      } else {
        setArbitres((prev) => [saved, ...prev]);
        setSuccess('Arbitre créé avec succès');
      }

      resetForm();
      setFormOpen(false);
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (arbitre: ArbitreDto) => {
    if (!window.confirm(`Supprimer l'arbitre "${arbitre.prenom} ${arbitre.nom}" ?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/arbitres?id=${arbitre._id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erreur lors de la suppression de l’arbitre');
      }

      setArbitres((prev) => prev.filter((a) => a._id !== arbitre._id));
      setSuccess('Arbitre supprimé avec succès');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Flag className="h-7 w-7 text-blue-600" />
            Gestion des Arbitres
          </h1>
          <p className="text-muted-foreground mt-2">
            Ajoutez, modifiez et supprimez les arbitres officiels. Vous pouvez également
            téléverser une photo pour chacun.
          </p>
        </div>

        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un arbitre
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
            <CardTitle>{editing ? 'Modifier un arbitre' : 'Nouvel arbitre'}</CardTitle>
            <CardDescription>
              {editing
                ? 'Mettez à jour les informations de l’arbitre sélectionné.'
                : 'Renseignez les informations du nouvel arbitre.'}
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
                  <Label htmlFor="categorie">Catégorie</Label>
                  <select
                    id="categorie"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={categorie}
                    onChange={(e) =>
                      setCategorie(
                        e.target.value as 'Élite' | 'Première Division' | 'Deuxième Division' | 'Régional' | ''
                      )
                    }
                    required
                  >
                    <option value="">Sélectionner</option>
                    <option value="Élite">Élite</option>
                    <option value="Première Division">Première Division</option>
                    <option value="Deuxième Division">Deuxième Division</option>
                    <option value="Régional">Régional</option>
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
                  <Label htmlFor="nationalite">Nationalité</Label>
                  <Input
                    id="nationalite"
                    value={nationalite}
                    onChange={(e) => setNationalite(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="actif"
                  type="checkbox"
                  checked={actif}
                  onChange={(e) => setActif(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="actif" className="cursor-pointer">
                  Actif
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Photo de l’arbitre</Label>
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
                  {editing ? 'Mettre à jour' : 'Créer l\'arbitre'}
                </LoadingButton>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Liste des arbitres</CardTitle>
          <CardDescription>
            {loading ? (
              <span className="flex items-center gap-2">
                <InlineLoader size="sm" />
                Chargement...
              </span>
            ) : (
              `Total : ${arbitres.length} arbitre(s)`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <InlineLoader size="lg" />
            </div>
          ) : arbitres.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun arbitre pour le moment. Cliquez sur &quot;Ajouter un arbitre&quot; pour
              commencer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Nationalité</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arbitres.map((a) => (
                    <TableRow key={a._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {a.photo ? (
                            <Image
                              src={a.photo}
                              alt={`${a.prenom} ${a.nom}`}
                              width={32}
                              height={32}
                              className="rounded-full border bg-white object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-xs">
                              {a.prenom.charAt(0).toUpperCase()}
                              {a.nom.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {a.prenom} {a.nom}
                      </TableCell>
                      <TableCell>{a.categorie}</TableCell>
                      <TableCell>{a.nationalite}</TableCell>
                      <TableCell>{a.ville}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                            a.actif
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          )}
                        >
                          {a.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="outline" onClick={() => openEditForm(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleDelete(a)}
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


