import { useState, useEffect } from 'react';

interface PlayerAvailability {
  player: {
    _id: string;
    nom: string;
    prenom: string;
    numeroMaillot?: number;
  };
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

/**
 * Hook to get player availability for a match
 * Useful for filtering unavailable players in lineup selection
 */
export function usePlayerAvailability(matchId: string | null) {
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) {
      setAvailability(null);
      return;
    }

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
        setAvailability(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [matchId]);

  /**
   * Check if a player is available for the match
   */
  const isPlayerAvailable = (playerId: string, club: 'home' | 'away'): boolean => {
    if (!availability) return true; // If no data, assume available
    
    const clubData = availability[club];
    return clubData.available.some((p) => p.player._id === playerId);
  };

  /**
   * Get availability info for a specific player
   */
  const getPlayerAvailability = (playerId: string, club: 'home' | 'away'): PlayerAvailability | null => {
    if (!availability) return null;
    
    const clubData = availability[club];
    const allPlayers = [...clubData.available, ...clubData.unavailable];
    return allPlayers.find((p) => p.player._id === playerId) || null;
  };

  /**
   * Get all available players for a club
   */
  const getAvailablePlayers = (club: 'home' | 'away'): PlayerAvailability[] => {
    if (!availability) return [];
    return availability[club].available;
  };

  /**
   * Get all unavailable players for a club
   */
  const getUnavailablePlayers = (club: 'home' | 'away'): PlayerAvailability[] => {
    if (!availability) return [];
    return availability[club].unavailable;
  };

  /**
   * Filter out unavailable players from a list of player IDs
   */
  const filterAvailablePlayers = (playerIds: string[], club: 'home' | 'away'): string[] => {
    if (!availability) return playerIds; // If no data, return all
    
    const availableIds = availability[club].available.map((p) => p.player._id);
    return playerIds.filter((id) => availableIds.includes(id));
  };

  return {
    availability,
    loading,
    error,
    isPlayerAvailable,
    getPlayerAvailability,
    getAvailablePlayers,
    getUnavailablePlayers,
    filterAvailablePlayers,
  };
}



