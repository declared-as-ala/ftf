'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Calendar, MapPin, User, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InlineLoader } from '@/components/Loader';
import PlayerAvailability from '@/components/PlayerAvailability';
import { cn } from '@/lib/utils';

interface Club {
  _id: string;
  nom: string;
  logo?: string;
}

interface Competition {
  _id: string;
  nom: string;
}

interface MatchEvent {
  type: 'But' | 'Carton Jaune' | 'Carton Rouge' | 'Remplacement' | 'Autre';
  minute: number;
  equipe?: 'home' | 'away';
  joueurId?: {
    _id: string;
    nom: string;
    prenom: string;
    numeroMaillot?: number;
  };
  description?: string;
}

interface Match {
  _id: string;
  competitionId: Competition | string;
  saisonId: { nom: string } | string;
  journee: number;
  homeClubId: Club | string;
  awayClubId: Club | string;
  date: string;
  stade: string;
  scoreHome: number;
  scoreAway: number;
  statut: 'Programmé' | 'En Cours' | 'Terminé' | 'Reporté' | 'Annulé' | 'À Valider';
  arbitrePrincipalId?: {
    nom: string;
    prenom: string;
  };
  evenements?: MatchEvent[];
  notes?: string;
  spectateurs?: number;
}

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/matchs/${matchId}`);
        if (!res.ok) {
          throw new Error('Erreur lors du chargement du match');
        }
        const data = await res.json();
        setMatch(data);
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    if (matchId) {
      fetchMatch();
    }
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <InlineLoader size="lg" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/admin/matchs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux matchs
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-600">{error || 'Match introuvable'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const homeClub = typeof match.homeClubId === 'string' ? null : match.homeClubId;
  const awayClub = typeof match.awayClubId === 'string' ? null : match.awayClubId;
  const competition = typeof match.competitionId === 'string' ? null : match.competitionId;
  const saison = typeof match.saisonId === 'string' ? null : match.saisonId;

  const matchDate = new Date(match.date);
  const isUpcoming = match.statut === 'Programmé' || match.statut === 'En Cours';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/admin/matchs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux matchs
        </Button>
      </div>

      {/* Match Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                {competition?.nom || 'Compétition'}
              </CardTitle>
              <CardDescription className="mt-1">
                Journée {match.journee} • {saison?.nom || 'Saison'}
              </CardDescription>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
                  match.statut === 'Terminé'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : match.statut === 'En Cours'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : match.statut === 'Reporté'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : match.statut === 'Annulé'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                )}
              >
                {match.statut}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Teams & Score */}
          <div className="flex items-center justify-between py-6">
            {/* Home Team */}
            <div className="flex-1 flex items-center justify-end gap-4">
              <div className="text-right">
                <h3 className="text-xl font-bold">{homeClub?.nom || 'Équipe Domicile'}</h3>
              </div>
              {homeClub?.logo && (
                <div className="relative h-16 w-16 rounded-full bg-white shadow overflow-hidden flex items-center justify-center">
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
            <div className="px-8">
              {match.statut === 'Terminé' || match.statut === 'En Cours' ? (
                <div className="text-4xl font-bold">
                  {match.scoreHome} - {match.scoreAway}
                </div>
              ) : (
                <div className="text-2xl text-muted-foreground">vs</div>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 flex items-center gap-4">
              {awayClub?.logo && (
                <div className="relative h-16 w-16 rounded-full bg-white shadow overflow-hidden flex items-center justify-center">
                  <Image
                    src={awayClub.logo}
                    alt={awayClub.nom}
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold">{awayClub?.nom || 'Équipe Extérieur'}</h3>
              </div>
            </div>
          </div>

          {/* Match Details */}
          <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {matchDate.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{match.stade}</span>
            </div>
          </div>

          {match.arbitrePrincipalId && (
            <div className="pt-4 border-t mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>
                  Arbitre: {match.arbitrePrincipalId.prenom} {match.arbitrePrincipalId.nom}
                </span>
              </div>
            </div>
          )}

          {match.spectateurs && (
            <div className="pt-2">
              <div className="text-sm text-muted-foreground">
                Spectateurs: {match.spectateurs.toLocaleString('fr-FR')}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player Availability - Only for upcoming matches */}
      {isUpcoming && homeClub && awayClub && (
        <PlayerAvailability
          matchId={matchId}
          homeClubName={homeClub.nom}
          awayClubName={awayClub.nom}
        />
      )}

      {/* Match Events - Only for finished/ongoing matches */}
      {(match.statut === 'Terminé' || match.statut === 'En Cours') && match.evenements && match.evenements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Événements du Match</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {match.evenements
                .sort((a, b) => b.minute - a.minute)
                .map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg border"
                  >
                    <span className="text-sm font-medium min-w-[40px]">{event.minute}'</span>
                    <div className="flex-1">
                      {event.type === 'But' && (
                        <span className="text-green-600 font-medium">⚽ But</span>
                      )}
                      {event.type === 'Carton Jaune' && (
                        <span className="text-yellow-600 font-medium">🟨 Carton Jaune</span>
                      )}
                      {event.type === 'Carton Rouge' && (
                        <span className="text-red-600 font-medium">🟥 Carton Rouge</span>
                      )}
                      {event.type === 'Remplacement' && (
                        <span className="text-blue-600 font-medium">🔄 Remplacement</span>
                      )}
                      {event.joueurId && (
                        <span className="ml-2">
                          {event.joueurId.prenom} {event.joueurId.nom}
                          {event.joueurId.numeroMaillot && ` (#${event.joueurId.numeroMaillot})`}
                        </span>
                      )}
                      {event.description && (
                        <span className="ml-2 text-muted-foreground text-sm">{event.description}</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {match.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{match.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
