'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineLoader } from '@/components/Loader';
import { UserCog, Search } from 'lucide-react';

interface StaffMember {
  _id: string;
  nom: string;
  prenom: string;
  type: string;
  nationalite: string;
  licenceValide: boolean;
  clubId?: { _id: string; nom: string; code?: string; logo?: string };
  certifications?: { type: string; organisme?: string }[];
}

const STAFF_TYPES = [
  'Entraîneur Principal',
  'Entraîneur Adjoint',
  'Préparateur Physique',
  'Médecin',
  'Kinésithérapeute',
  'Analyste Vidéo',
  'Recruteur',
  'Directeur Sportif',
];

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (typeFilter) params.set('type', typeFilter);
        const res = await fetch(`/api/admin/staff?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Erreur lors du chargement du staff');
        const data = await res.json();
        setStaff(data.staff || []);
      } catch (e: any) {
        if (e.name !== 'AbortError') setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }, 300); // debounce

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, typeFilter]);

  const byClub = useMemo(() => {
    const groups = new Map<string, { club: StaffMember['clubId']; members: StaffMember[] }>();
    for (const m of staff) {
      const key = m.clubId?._id || 'sans-club';
      if (!groups.has(key)) groups.set(key, { club: m.clubId, members: [] });
      groups.get(key)!.members.push(m);
    }
    return Array.from(groups.values());
  }, [staff]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff technique"
        description="Encadrement technique et médical déclaré par club (consultation)"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filtrer par fonction"
        >
          <option value="">Toutes les fonctions</option>
          {STAFF_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <InlineLoader size="lg" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-600 text-sm">{error}</p>
          </CardContent>
        </Card>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Aucun membre du staff"
          description="Aucun membre du staff ne correspond aux filtres sélectionnés."
        />
      ) : (
        <div className="space-y-6">
          {byClub.map(({ club, members }) => (
            <Card key={club?._id || 'sans-club'}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  {club?.logo && (
                    <div className="relative h-8 w-8 overflow-hidden rounded-full bg-white border">
                      <Image src={club.logo} alt={club.nom} fill className="object-contain" />
                    </div>
                  )}
                  <h2 className="font-semibold">{club?.nom || 'Sans club'}</h2>
                  <Badge variant="outline">{members.length}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Fonction</TableHead>
                        <TableHead>Nationalité</TableHead>
                        <TableHead>Certification</TableHead>
                        <TableHead>Licence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow key={m._id}>
                          <TableCell className="font-medium">
                            {m.prenom} {m.nom}
                          </TableCell>
                          <TableCell>{m.type}</TableCell>
                          <TableCell className="text-muted-foreground">{m.nationalite}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {m.certifications?.[0]
                              ? `${m.certifications[0].type}${m.certifications[0].organisme ? ` (${m.certifications[0].organisme})` : ''}`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {m.licenceValide ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
                                Valide
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Invalide</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
