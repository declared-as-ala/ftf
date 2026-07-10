'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Calendar, BarChart3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InlineLoader } from '@/components/Loader';
import { cn } from '@/lib/utils';

type MatchStatut = 'Programmé' | 'En Cours' | 'Terminé' | 'Reporté' | 'Annulé' | 'À Valider';

interface CompetitionOption {
  _id: string;
  nom: string;
}

interface ClubOption {
  _id: string;
  nom: string;
  logo?: string;
}

interface MatchEvent {
  type: 'But' | 'Carton Jaune' | 'Carton Rouge' | 'Remplacement' | 'Autre';
  minute: number;
  equipe?: 'home' | 'away';
  joueurId?: {
    nom: string;
    prenom: string;
  };
}

interface MatchDto {
  _id: string;
  competitionId: string | CompetitionOption;
  journee: number;
  homeClubId: string | ClubOption;
  awayClubId: string | ClubOption;
  date: string;
  stade: string;
  scoreHome: number;
  scoreAway: number;
  statut: MatchStatut;
  evenements?: MatchEvent[];
}

type TabType = 'results' | 'fixtures' | 'standings';

export default function AdminMatchsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('results');
  const [matches, setMatches] = useState<MatchDto[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [matchesRes, competitionsRes, clubsRes] = await Promise.all([
          fetch('/api/admin/matchs', { cache: 'no-store' }),
          fetch('/api/admin/competitions', { cache: 'no-store' }),
          fetch('/api/admin/clubs', { cache: 'no-store' }),
        ]);

        if (!matchesRes.ok || !competitionsRes.ok || !clubsRes.ok) {
          throw new Error('Erreur lors du chargement des données');
        }

        const [matchesData, competitionsData, clubsData] = await Promise.all([
          matchesRes.json(),
          competitionsRes.json(),
          clubsRes.json(),
        ]);

        setMatches(matchesData);
        setCompetitions(competitionsData);
        setClubs(clubsData);

        // Set first competition as default if available
        if (competitionsData.length > 0 && !selectedCompetitionId) {
          setSelectedCompetitionId(competitionsData[0]._id);
        }
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getClubData = (clubId: string | ClubOption): ClubOption | null => {
    if (!clubId) return null;
    if (typeof clubId === 'string') {
      return clubs.find((c) => c._id === clubId) || null;
    }
    return clubId;
  };

  const getCompetitionName = (compId: string | CompetitionOption): string => {
    if (!compId) return '-';
    if (typeof compId === 'string') {
      const comp = competitions.find((c) => c._id === compId);
      return comp?.nom || '-';
    }
    return compId.nom;
  };

  // Filter matches based on active tab
  const filteredMatches = matches.filter((match) => {
    // Filter by competition if selected
    const compId = typeof match.competitionId === 'string' ? match.competitionId : match.competitionId._id;
    if (selectedCompetitionId && compId !== selectedCompetitionId) {
      return false;
    }

    // Filter by status based on tab
    if (activeTab === 'results') {
      return match.statut === 'Terminé';
    } else if (activeTab === 'fixtures') {
      return match.statut === 'Programmé' || match.statut === 'En Cours';
    }
    return true;
  });

  // Group matches by journee (round)
  const groupedByRound = filteredMatches.reduce((acc, match) => {
    const round = match.journee || 0;
    if (!acc[round]) {
      acc[round] = [];
    }
    acc[round].push(match);
    return acc;
  }, {} as Record<number, MatchDto[]>);

  // Sort rounds descending
  const sortedRounds = Object.keys(groupedByRound)
    .map(Number)
    .sort((a, b) => b - a);

  // Count cards for a match
  const getCardCounts = (match: MatchDto) => {
    if (!match.evenements) return { yellow: 0, red: 0 };
    const yellow = match.evenements.filter((e) => e.type === 'Carton Jaune').length;
    const red = match.evenements.filter((e) => e.type === 'Carton Rouge').length;
    return { yellow, red };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <InlineLoader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-7 w-7 text-orange-600" />
            Matchs
          </h1>
          <p className="text-muted-foreground mt-2">
            Résultats, calendrier et classements des compétitions
          </p>
        </div>
        <Button onClick={() => router.push('/admin/matchs/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau Match
        </Button>
      </div>

      {/* Competition Filter */}
      {competitions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Compétition:</label>
              <select
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
              >
                <option value="">Toutes les compétitions</option>
                {competitions.map((comp) => (
                  <option key={comp._id} value={comp._id}>
                    {comp.nom}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('results')}
            className={cn(
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'results'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            )}
          >
            Résultats
          </button>
          <button
            onClick={() => setActiveTab('fixtures')}
            className={cn(
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'fixtures'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            )}
          >
            Calendrier
          </button>
          <button
            onClick={() => router.push('/admin/classement')}
            className={cn(
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2',
              'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Classement
          </button>
        </nav>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {sortedRounds.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Aucun match terminé pour le moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedRounds.map((round) => {
              const roundMatches = groupedByRound[round];
              return (
                <Card key={round}>
                  <CardContent className="pt-6">
                    <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                      JOURNÉE {round}
                    </h2>
                    <div className="space-y-3">
                      {roundMatches.map((match) => {
                        const homeClub = getClubData(match.homeClubId);
                        const awayClub = getClubData(match.awayClubId);
                        const { date, time } = formatDate(match.date);
                        const cards = getCardCounts(match);

                        return (
                          <div
                            key={match._id}
                            className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/admin/matchs/${match._id}`)}
                          >
                            {/* Date & Time */}
                            <div className="text-xs text-muted-foreground min-w-[80px]">
                              <div>{date}</div>
                              <div className="font-medium">{time}</div>
                            </div>

                            {/* Teams & Score */}
                            <div className="flex-1 flex items-center gap-3">
                              {/* Home Team */}
                              <div className="flex-1 flex items-center justify-end gap-2">
                                <span className="text-sm font-medium text-right">
                                  {homeClub?.nom || '-'}
                                </span>
                                {homeClub?.logo && (
                                  <div className="relative h-6 w-6 rounded-full bg-white shadow overflow-hidden flex items-center justify-center">
                                    <Image
                                      src={homeClub.logo}
                                      alt={homeClub.nom}
                                      fill
                                      className="object-contain"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Score */}
                              <div className="flex items-center gap-2 min-w-[60px] justify-center">
                                <span className="text-lg font-bold">
                                  {match.scoreHome} - {match.scoreAway}
                                </span>
                              </div>

                              {/* Away Team */}
                              <div className="flex-1 flex items-center gap-2">
                                {awayClub?.logo && (
                                  <div className="relative h-6 w-6 rounded-full bg-white shadow overflow-hidden flex items-center justify-center">
                                    <Image
                                      src={awayClub.logo}
                                      alt={awayClub.nom}
                                      fill
                                      className="object-contain"
                                    />
                                  </div>
                                )}
                                <span className="text-sm font-medium">
                                  {awayClub?.nom || '-'}
                                </span>
                              </div>
                            </div>

                            {/* Cards */}
                            {(cards.yellow > 0 || cards.red > 0) && (
                              <div className="flex items-center gap-2 min-w-[60px]">
                                {cards.yellow > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className="h-4 w-4 rounded bg-yellow-400 border border-yellow-600" />
                                    <span className="text-xs">{cards.yellow}</span>
                                  </div>
                                )}
                                {cards.red > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className="h-4 w-4 rounded bg-red-600 border border-red-800" />
                                    <span className="text-xs">{cards.red}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Competition */}
                            <div className="text-xs text-muted-foreground min-w-[120px] text-right hidden lg:block">
                              {getCompetitionName(match.competitionId)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Fixtures Tab */}
      {activeTab === 'fixtures' && (
        <div className="space-y-6">
          {sortedRounds.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Aucun match programmé pour le moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedRounds.map((round) => {
              const roundMatches = groupedByRound[round];
              return (
                <Card key={round}>
                  <CardContent className="pt-6">
                    <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                      JOURNÉE {round}
                    </h2>
                    <div className="space-y-3">
                      {roundMatches.map((match) => {
                        const homeClub = getClubData(match.homeClubId);
                        const awayClub = getClubData(match.awayClubId);
                        const { date, time } = formatDate(match.date);

                        return (
                          <div
                            key={match._id}
                            className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/admin/matchs/${match._id}`)}
                          >
                            {/* Date & Time */}
                            <div className="text-xs text-muted-foreground min-w-[80px]">
                              <div>{date}</div>
                              <div className="font-medium">{time}</div>
                            </div>

                            {/* Teams */}
                            <div className="flex-1 flex items-center gap-3">
                              {/* Home Team */}
                              <div className="flex-1 flex items-center justify-end gap-2">
                                <span className="text-sm font-medium text-right">
                                  {homeClub?.nom || '-'}
                                </span>
                                {homeClub?.logo && (
                                  <div className="relative h-6 w-6 rounded-full bg-white shadow overflow-hidden flex items-center justify-center">
                                    <Image
                                      src={homeClub.logo}
                                      alt={homeClub.nom}
                                      fill
                                      className="object-contain"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* VS */}
                              <div className="flex items-center gap-2 min-w-[60px] justify-center">
                                <span className="text-sm text-muted-foreground">vs</span>
                              </div>

                              {/* Away Team */}
                              <div className="flex-1 flex items-center gap-2">
                                {awayClub?.logo && (
                                  <div className="relative h-6 w-6 rounded-full bg-white shadow overflow-hidden flex items-center justify-center">
                                    <Image
                                      src={awayClub.logo}
                                      alt={awayClub.nom}
                                      fill
                                      className="object-contain"
                                    />
                                  </div>
                                )}
                                <span className="text-sm font-medium">
                                  {awayClub?.nom || '-'}
                                </span>
                              </div>
                            </div>

                            {/* Stadium */}
                            <div className="text-xs text-muted-foreground min-w-[120px] text-right hidden md:block">
                              {match.stade}
                            </div>

                            {/* Status */}
                            <div className="min-w-[100px] text-right">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                                  match.statut === 'En Cours'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                )}
                              >
                                {match.statut}
                              </span>
                            </div>

                            {/* Competition */}
                            <div className="text-xs text-muted-foreground min-w-[120px] text-right hidden lg:block">
                              {getCompetitionName(match.competitionId)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
