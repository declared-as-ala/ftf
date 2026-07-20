'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarClock, History, UserRound, MapPin } from 'lucide-react';

interface AssignmentEntry {
  assignmentId: string;
  matchId: string;
  date: string;
  stade: string;
  statut: string;
  homeClub: { _id: string; nom: string; logo?: string; code?: string };
  awayClub: { _id: string; nom: string; logo?: string; code?: string };
  role: string;
}

interface RefereeDetail {
  referee: {
    _id: string;
    nom: string;
    prenom: string;
    categorie: string;
    ville: string;
    region?: string;
    status: string;
    licence?: string;
    email?: string;
    telephone?: string;
  };
  assignments: {
    upcomingCount: number;
    previousCount: number;
    totalCount: number;
    upcoming: AssignmentEntry[];
    previous: AssignmentEntry[];
  };
}

const roleLabel: Record<string, string> = {
  MAIN: 'Arbitre principal',
  ASSISTANT_1: 'Assistant 1',
  ASSISTANT_2: 'Assistant 2',
  FOURTH_OFFICIAL: '4e arbitre',
};

function AssignmentRow({ entry }: { entry: AssignmentEntry }) {
  return (
    <Link
      href={`/admin/matches/${entry.matchId}`}
      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {entry.homeClub?.nom} vs {entry.awayClub?.nom}
        </p>
        <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {entry.stade}
          </span>
        </p>
      </div>
      <Badge variant={entry.role === 'MAIN' ? 'default' : 'secondary'} className="shrink-0 text-xs">
        {roleLabel[entry.role] || entry.role}
      </Badge>
    </Link>
  );
}

export default function RefereeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<RefereeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/referees/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Arbitre introuvable');
        setData(await r.json());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState title={error || 'Arbitre introuvable'} description="Impossible de charger cet arbitre." />;
  }

  const { referee, assignments } = data;

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <PageHeader
        title={`${referee.prenom} ${referee.nom}`}
        description={`${referee.categorie} · ${referee.region ? `${referee.region} (${referee.ville})` : referee.ville}${referee.licence ? ` · Licence ${referee.licence}` : ''}`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Désignations totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{assignments.totalCount}</p>
            <p className="text-xs text-muted-foreground">Toutes publiées</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">À venir</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{assignments.upcomingCount}</p>
            <p className="text-xs text-muted-foreground">Matchs programmés</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Officiées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{assignments.previousCount}</p>
            <p className="text-xs text-muted-foreground">Matchs passés</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              Prochaines désignations
            </CardTitle>
            <CardDescription>Matchs publiés à venir</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.upcoming.length === 0 ? (
              <EmptyState icon={UserRound} title="Aucune désignation à venir" />
            ) : (
              <div className="space-y-2">
                {assignments.upcoming.map((entry) => (
                  <AssignmentRow key={entry.assignmentId} entry={entry} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Historique
            </CardTitle>
            <CardDescription>Matchs déjà officiés</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.previous.length === 0 ? (
              <EmptyState icon={History} title="Aucun historique" />
            ) : (
              <div className="space-y-2">
                {assignments.previous.map((entry) => (
                  <AssignmentRow key={entry.assignmentId} entry={entry} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
