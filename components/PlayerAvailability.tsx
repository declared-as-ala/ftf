'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InlineLoader } from '@/components/Loader';
import { cn } from '@/lib/utils';

interface Player {
  _id: string;
  nom: string;
  prenom: string;
  numeroMaillot?: number;
}

interface PlayerAvailability {
  player: Player;
  club: 'home' | 'away';
  available: boolean;
  reason: string | null;
  remainingMatches: number;
  yellowCards: number;
}

interface AvailabilityData {
  home: {
    available: PlayerAvailability[];
    unavailable: PlayerAvailability[];
  };
  away: {
    available: PlayerAvailability[];
    unavailable: PlayerAvailability[];
  };
}

interface PlayerAvailabilityProps {
  matchId: string;
  homeClubName: string;
  awayClubName: string;
}

export default function PlayerAvailability({ matchId, homeClubName, awayClubName }: PlayerAvailabilityProps) {
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/matchs/${matchId}/availability`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Erreur lors du chargement de la disponibilité');
        }
        const data = await res.json();
        setAvailability(data);
      } catch (e: any) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    if (matchId) {
      fetchAvailability();
    }
  }, [matchId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Disponibilité des Joueurs</CardTitle>
          <CardDescription>Vérification de la disponibilité...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <InlineLoader size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Disponibilité des Joueurs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!availability) {
    return null;
  }

  const renderPlayerList = (players: PlayerAvailability[], isAvailable: boolean) => {
    if (players.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {isAvailable ? 'Aucun joueur disponible' : 'Aucun joueur indisponible'}
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {players.map((p) => (
          <div
            key={p.player._id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              isAvailable
                ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              {isAvailable ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {p.player.prenom} {p.player.nom}
                  </span>
                  {p.player.numeroMaillot && (
                    <span className="text-xs text-muted-foreground">#{p.player.numeroMaillot}</span>
                  )}
                </div>
                {!isAvailable && (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{p.reason}</span>
                    {p.remainingMatches > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium dark:bg-red-900/30 dark:text-red-300">
                        <Ban className="h-3 w-3" />
                        {p.remainingMatches} match{p.remainingMatches > 1 ? 's' : ''} restant{p.remainingMatches > 1 ? 's' : ''}
                      </span>
                    )}
                    {p.yellowCards > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium dark:bg-yellow-900/30 dark:text-yellow-300">
                        <AlertTriangle className="h-3 w-3" />
                        {p.yellowCards} carton{p.yellowCards > 1 ? 's' : ''} jaune{p.yellowCards > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Home Team */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg font-semibold">{homeClubName}</span>
            <span className="text-sm text-muted-foreground font-normal">
              ({availability.home.available.length} disponible{availability.home.available.length > 1 ? 's' : ''}, {availability.home.unavailable.length} indisponible{availability.home.unavailable.length > 1 ? 's' : ''})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {availability.home.unavailable.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Indisponibles ({availability.home.unavailable.length})
              </h4>
              {renderPlayerList(availability.home.unavailable, false)}
            </div>
          )}
          {availability.home.available.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Disponibles ({availability.home.available.length})
              </h4>
              {renderPlayerList(availability.home.available, true)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Away Team */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg font-semibold">{awayClubName}</span>
            <span className="text-sm text-muted-foreground font-normal">
              ({availability.away.available.length} disponible{availability.away.available.length > 1 ? 's' : ''}, {availability.away.unavailable.length} indisponible{availability.away.unavailable.length > 1 ? 's' : ''})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {availability.away.unavailable.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Indisponibles ({availability.away.unavailable.length})
              </h4>
              {renderPlayerList(availability.away.unavailable, false)}
            </div>
          )}
          {availability.away.available.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Disponibles ({availability.away.available.length})
              </h4>
              {renderPlayerList(availability.away.available, true)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



