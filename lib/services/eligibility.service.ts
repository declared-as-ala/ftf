import mongoose from 'mongoose';
import Suspension from '../models/Suspension';
import DisciplinaryCard from '../models/DisciplinaryCard';
import Joueur from '../models/Joueur';

/**
 * EligibilityService — absorbs DisciplineService.getPlayerAvailabilityForMatch
 *
 * §6.6: detects SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT anomaly
 * R-001: "at risk" flag when player has (threshold - 1) active yellows
 *
 * Returns per-player availability for both clubs in a match.
 */
export interface PlayerEligibility {
  player: {
    _id: string;
    nom: string;
    prenom: string;
    numeroMaillot?: number;
  };
  club: 'home' | 'away';
  available: boolean;
  atRisk: boolean;        // One more yellow → suspension
  activeYellows: number;
  suspensions: {
    _id: string;
    suspensionType: string;
    matchesRemaining: number;
    status: string;
  }[];
}

export interface EligibilityAnomaly {
  joueurId: string;
  matchId: string;
  type: 'SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT';
  suspensionId: string;
  notes: string;
}

export class EligibilityService {
  static async getMatchEligibility(
    matchId: string,
    homeClubId: string,
    awayClubId: string,
    saisonId: string,
    yellowThreshold: number,
    organizationId: string
  ): Promise<{ home: PlayerEligibility[]; away: PlayerEligibility[] }> {
    const [homePlayers, awayPlayers] = await Promise.all([
      Joueur.find({ organizationId, clubId: homeClubId, status: 'ACTIVE' }).lean(),
      Joueur.find({ organizationId, clubId: awayClubId, status: 'ACTIVE' }).lean(),
    ]);

    const allClubIds = [homeClubId, awayClubId];

    // All active/provisional suspensions for both clubs
    const suspensions = await Suspension.find({
      organizationId,
      clubId: { $in: allClubIds },
      status: { $in: ['ACTIVE', 'PROVISIONAL'] },
    }).lean();

    // Map: joueurId → suspensions
    const suspMap: Record<string, any[]> = {};
    for (const s of suspensions) {
      const key = s.joueurId.toString();
      if (!suspMap[key]) suspMap[key] = [];
      suspMap[key].push(s);
    }

    // Active yellow count per player for this season
    const yellowCards = await DisciplinaryCard.find({
      organizationId,
      clubId: { $in: allClubIds },
      saisonId,
      cardType: 'YELLOW',
      accumulationStatus: 'ACTIVE',
    }).lean();

    const yellowCount: Record<string, number> = {};
    for (const c of yellowCards) {
      const key = c.joueurId.toString();
      yellowCount[key] = (yellowCount[key] || 0) + 1;
    }

    const makeEligibility = (players: any[], club: 'home' | 'away'): PlayerEligibility[] =>
      players.map((p) => {
        const id = p._id.toString();
        const playerSuspensions = suspMap[id] || [];
        const yellows = yellowCount[id] || 0;
        const hasActiveSuspension = playerSuspensions.some(
          (s) => s.status === 'ACTIVE' || s.status === 'PROVISIONAL'
        );
        const atRisk = !hasActiveSuspension && yellows === yellowThreshold - 1;

        return {
          player: {
            _id: id,
            nom: p.nom,
            prenom: p.prenom,
            numeroMaillot: p.numeroMaillot,
          },
          club,
          available: !hasActiveSuspension,
          atRisk,
          activeYellows: yellows,
          suspensions: playerSuspensions.map((s) => ({
            _id: s._id.toString(),
            suspensionType: s.suspensionType,
            matchesRemaining: s.matchesRemaining,
            status: s.status,
          })),
        };
      });

    return {
      home: makeEligibility(homePlayers, 'home'),
      away: makeEligibility(awayPlayers, 'away'),
    };
  }

  /**
   * R-009: Detect suspended players listed as participants in a finalized match.
   * Called post-finalization.
   */
  static async detectAnomalies(match: any): Promise<EligibilityAnomaly[]> {
    const anomalies: EligibilityAnomaly[] = [];

    const participantIds = [
      ...(match.feuilleMatchElectronique?.homeComposition || []),
      ...(match.feuilleMatchElectronique?.awayComposition || []),
    ].map((id: any) => id.toString());

    if (participantIds.length === 0) return anomalies;

    const suspensions = await Suspension.find({
      organizationId: match.organizationId,
      joueurId: { $in: participantIds },
      status: { $in: ['ACTIVE', 'PROVISIONAL'] },
    }).lean();

    for (const s of suspensions) {
      const joueurIdStr = s.joueurId.toString();
      if (participantIds.includes(joueurIdStr)) {
        anomalies.push({
          joueurId: joueurIdStr,
          matchId: match._id.toString(),
          type: 'SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT',
          suspensionId: s._id.toString(),
          notes: `Joueur suspendu (${s.suspensionType}, ${s.matchesRemaining} match(s) restant(s)) enregistré dans la composition du match`,
        });
      }
    }

    return anomalies;
  }
}

export default EligibilityService;
