'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, Plus, Pencil, Trash2, User, Eye } from 'lucide-react';
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

type ArbitreCategorie = 'Élite' | 'Première Division' | 'Deuxième Division' | 'Régional' | 'ELITE' | 'NATIONAL' | 'REGIONAL';
type ArbitreStatus = 'ACTIVE' | 'UNAVAILABLE' | 'SUSPENDED' | 'INACTIVE' | 'ARCHIVED';

interface ArbitreDto {
  _id: string;
  nom: string;
  prenom: string;
  categorie: ArbitreCategorie;
  dateNaissance: string;
  nationalite: string;
  email?: string;
  telephone?: string;
  ville: string;
  status: ArbitreStatus;
  licence?: string;
  region?: string;
  notes?: string;
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
  const [status, setStatus] = useState<ArbitreStatus>('ACTIVE');
  const [licence, setLicence] = useState('');
  const [region, setRegion] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchArbitres = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/referees?limit=100', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Erreur lors du chargement des arbitres');
        }
        const data = await res.json();
        setArbitres(data.referees || []);
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
    setStatus('ACTIVE');
    setLicence('');
    setRegion('');
    setNotes('');
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
    setStatus(a.status || 'ACTIVE');
    setLicence(a.licence || '');
    setRegion(a.region || '');
    setNotes(a.notes || '');
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const isEdit = !!editing;
      const url = isEdit && editing ? `/api/admin/referees/${editing._id}` : '/api/admin/referees';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          prenom,
          categorie,
          dateNaissance,
          nationalite,
          ville,
          email: email || undefined,
          telephone: telephone || undefined,
          status,
          licence: licence || undefined,
          region: region || undefined,
          notes: notes || undefined,
        }),
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
    if (!window.confirm(`Archiver l'arbitre "${arbitre.prenom} ${arbitre.nom}" ?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/referees/${arbitre._id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erreur lors de l’archivage de l’arbitre');
      }

      setArbitres((prev) => prev.filter((a) => a._id !== arbitre._id));
      setSuccess('Arbitre archivé avec succès');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    }
  };

  const translateCategory = (cat: ArbitreCategorie) => {
    switch (cat) {
      case 'ELITE': return 'Élite';
      case 'NATIONAL': return 'Niveau National';
      case 'REGIONAL': return 'Niveau Régional';
      default: return cat;
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
            Ajoutez, modifiez et gérez le registre des arbitres officiels de la fédération.
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
                      setCategorie(e.target.value as ArbitreCategorie)
                    }
                    required
                  >
                    <option value="">Sélectionner</option>
                    <option value="ELITE">Élite (ELITE)</option>
                    <option value="NATIONAL">National (NATIONAL)</option>
                    <option value="REGIONAL">Régional (REGIONAL)</option>
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

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="licence">Code / N° Licence</Label>
                  <Input
                    id="licence"
                    value={licence}
                    onChange={(e) => setLicence(e.target.value)}
                    placeholder="Ex: LIC-998822"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Région (Ligue)</Label>
                  <Input
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Ex: Tunis, Sousse..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Statut Disciplinaire</Label>
                  <select
                    id="status"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ArbitreStatus)}
                    required
                  >
                    <option value="ACTIVE">Actif (ACTIVE)</option>
                    <option value="UNAVAILABLE">Indisponible (UNAVAILABLE)</option>
                    <option value="SUSPENDED">Suspendu (SUSPENDED)</option>
                    <option value="INACTIVE">Inactif (INACTIVE)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes / Observations</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes facultatives concernant l'arbitre..."
                  className="min-h-24 w-full rounded-md border bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                />
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
          <CardTitle>Registre des Arbitres</CardTitle>
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
                    <TableHead>Avatar</TableHead>
                    <TableHead>Licence / Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Région / Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arbitres.map((a) => (
                    <TableRow key={a._id}>
                      <TableCell>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-xs text-muted-foreground">
                          <User className="h-4 w-4" />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.licence || 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {a.prenom} {a.nom}
                      </TableCell>
                      <TableCell>{translateCategory(a.categorie)}</TableCell>
                      <TableCell>
                        {a.region ? `${a.region} (${a.ville})` : a.ville}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                            a.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : a.status === 'UNAVAILABLE'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : a.status === 'SUSPENDED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          )}
                        >
                          {a.status === 'ACTIVE'
                            ? 'Actif'
                            : a.status === 'UNAVAILABLE'
                            ? 'Indisponible'
                            : a.status === 'SUSPENDED'
                            ? 'Suspendu'
                            : 'Inactif'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="outline" asChild>
                            <Link href={`/admin/arbitres/${a._id}`} aria-label="Voir les désignations">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
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
