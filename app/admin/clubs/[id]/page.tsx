'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Calendar, Clock, Flag, MapPin, Users, Trophy, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FullPageLoader, InlineLoader } from '@/components/Loader';
import { cn } from '@/lib/utils';

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
  capaciteStade?: number;
  siteweb?: string;
  telephone?: string;
}

interface Player {
  _id: string;
  nom: string;
  prenom: string;
  numeroMaillot?: number;
  position: string;
  nationalite: string;
  stats: {
    matchsJoues: number;
    buts: number;
    passes: number;
  };
}

interface StaffMember {
  _id: string;
  nom: string;
  prenom: string;
  type: string;
  nationalite: string;
}

interface Match {
  _id: string;
  date: string;
  journee: number;
  homeClubId: { _id: string; nom: string; logo?: string };
  awayClubId: { _id: string; nom: string; logo?: string };
  competitionId: { _id: string; nom: string };
  saisonId: { _id: string; nom: string };
  stade: string;
  scoreHome: number;
  scoreAway: number;
  statut: string;
  arbitrePrincipalId?: { _id: string; nom: string; prenom: string };
  evenements: any[];
}

interface ClubDetail {
  club: Club;
  players: Player[];
  staff: StaffMember[];
  fixtures: Match[];
  results: Match[];
}

export default function ClubDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ClubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClubDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/clubs/${params.id}`, { cache: 'no-store' });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Erreur lors du chargement du club');
        }
        const clubData: ClubDetail = await res.json();
        setData(clubData);
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchClubDetail();
    }
  }, [params.id]);

  if (loading) {
    return <FullPageLoader />;
  }

  if (!data || error) {
    return (
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button variant="outline" onClick={() => router.push('/admin/clubs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux clubs
        </Button>
      </div>
    );
  }

  const { club, players, staff, fixtures, results } = data;
  const headCoach = staff.find((s) => s.type === 'Entraîneur Principal');
  const coachingStaff = staff.filter((s) => s.type !== 'Entraîneur Principal');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.push('/admin/clubs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la liste
        </Button>
      </div>

      {/* Club Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-6">
            <div className="relative h-24 w-24 rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden border-2 border-border">
              {club.logo ? (
                <Image src={club.logo} alt={club.nom} fill className="object-contain" />
              ) : (
                <span className="text-2xl font-bold">{club.nom.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-3xl mb-2">{club.nom}</CardTitle>
              <CardDescription className="text-base">{club.description}</CardDescription>
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{club.ville}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Fondé en {club.fondation}</span>
                </div>
                {club.stade && (
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    <span>{club.stade}</span>
                  </div>
                )}
              </div>
              {club.couleurs && club.couleurs.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">Couleurs:</span>
                  <div className="flex gap-2">
                    {club.couleurs.map((c, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded text-xs font-medium bg-muted"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {club.emailOfficiel && (
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{club.emailOfficiel}</p>
              </div>
            )}
            {club.telephone && (
              <div>
                <span className="text-muted-foreground">Téléphone:</span>
                <p className="font-medium">{club.telephone}</p>
              </div>
            )}
            {club.siteweb && (
              <div>
                <span className="text-muted-foreground">Site web:</span>
                <p className="font-medium">
                  <a href={club.siteweb} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {club.siteweb.replace(/^https?:\/\//, '')}
                  </a>
                </p>
              </div>
            )}
            {club.capaciteStade && (
              <div>
                <span className="text-muted-foreground">Capacité:</span>
                <p className="font-medium">{club.capaciteStade.toLocaleString()} places</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Fixtures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Matchs à venir ({fixtures.length})
            </CardTitle>
            <CardDescription>Prochains matchs programmés</CardDescription>
          </CardHeader>
          <CardContent>
            {fixtures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun match programmé</p>
            ) : (
              <div className="space-y-3">
                {fixtures.slice(0, 5).map((match) => {
                  const isHome = match.homeClubId._id === club._id;
                  const opponent = isHome ? match.awayClubId : match.homeClubId;
                  return (
                    <div
                      key={match._id}
                      className="p-3 border rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/matchs/${match._id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          Journée {match.journee} • {match.competitionId.nom}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(match.date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-right">
                          {isHome ? (
                            <span className="font-semibold">{club.nom}</span>
                          ) : (
                            <span>{opponent.nom}</span>
                          )}
                        </div>
                        <span className="text-muted-foreground">vs</span>
                        <div className="flex-1">
                          {isHome ? (
                            <span>{opponent.nom}</span>
                          ) : (
                            <span className="font-semibold">{club.nom}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {isHome ? 'Domicile' : 'Extérieur'} • {match.stade}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Résultats ({results.length})
            </CardTitle>
            <CardDescription>Matchs terminés</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun résultat disponible</p>
            ) : (
              <div className="space-y-3">
                {results.slice(0, 5).map((match) => {
                  const isHome = match.homeClubId._id === club._id;
                  const opponent = isHome ? match.awayClubId : match.homeClubId;
                  const clubScore = isHome ? match.scoreHome : match.scoreAway;
                  const opponentScore = isHome ? match.scoreAway : match.scoreHome;
                  const won = clubScore > opponentScore;
                  const draw = clubScore === opponentScore;
                  return (
                    <div
                      key={match._id}
                      className={cn(
                        'p-3 border rounded-md hover:bg-accent/50 cursor-pointer transition-colors',
                        won && 'bg-emerald-50/50 dark:bg-emerald-900/10',
                        draw && 'bg-amber-50/50 dark:bg-amber-900/10',
                        !won && !draw && 'bg-red-50/50 dark:bg-red-900/10'
                      )}
                      onClick={() => router.push(`/admin/matchs/${match._id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          Journée {match.journee} • {match.competitionId.nom}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(match.date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-right">
                          {isHome ? (
                            <span className="font-semibold">{club.nom}</span>
                          ) : (
                            <span>{opponent.nom}</span>
                          )}
                        </div>
                        <span className="text-lg font-bold">
                          {isHome ? match.scoreHome : match.scoreAway} -{' '}
                          {isHome ? match.scoreAway : match.scoreHome}
                        </span>
                        <div className="flex-1">
                          {isHome ? (
                            <span>{opponent.nom}</span>
                          ) : (
                            <span className="font-semibold">{club.nom}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Players */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Joueurs ({players.length})
          </CardTitle>
          <CardDescription>Effectif du club</CardDescription>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun joueur enregistré</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Nationalité</TableHead>
                    <TableHead className="text-right">MJ</TableHead>
                    <TableHead className="text-right">Buts</TableHead>
                    <TableHead className="text-right">Passes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => (
                    <TableRow key={player._id}>
                      <TableCell className="font-semibold">
                        {player.numeroMaillot || '-'}
                      </TableCell>
                      <TableCell>
                        {player.prenom} {player.nom}
                      </TableCell>
                      <TableCell>{player.position}</TableCell>
                      <TableCell>{player.nationalite}</TableCell>
                      <TableCell className="text-right">{player.stats.matchsJoues}</TableCell>
                      <TableCell className="text-right">{player.stats.buts}</TableCell>
                      <TableCell className="text-right">{player.stats.passes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Staff ({staff.length})
          </CardTitle>
          <CardDescription>Équipe technique et médicale</CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun membre du staff enregistré</p>
          ) : (
            <div className="space-y-4">
              {headCoach && (
                <div className="p-4 border rounded-md bg-primary/5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCheck className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">
                        {headCoach.prenom} {headCoach.nom}
                      </p>
                      <p className="text-sm text-muted-foreground">{headCoach.type}</p>
                      <p className="text-xs text-muted-foreground">{headCoach.nationalite}</p>
                    </div>
                  </div>
                </div>
              )}
              {coachingStaff.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {coachingStaff.map((member) => (
                    <div key={member._id} className="p-3 border rounded-md">
                      <p className="font-medium">
                        {member.prenom} {member.nom}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.type}</p>
                      <p className="text-xs text-muted-foreground">{member.nationalite}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




