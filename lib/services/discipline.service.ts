import Discipline from '../models/Discipline';
import Joueur from '../models/Joueur';
import Staff from '../models/Staff';
import Saison from '../models/Saison';
import connectDB from '../db';

/**
 * Service de gestion automatique de la discipline
 */
export class DisciplineService {
  /**
   * Traite un carton jaune et vérifie si suspension automatique nécessaire
   */
  static async traiterCartonJaune(
    joueurId: string,
    clubId: string,
    matchId: string,
    saisonId: string,
    raison: string
  ) {
    await connectDB();

    // Récupérer la configuration de la saison
    const saison = await Saison.findById(saisonId);
    if (!saison) throw new Error('Saison non trouvée');

    const seuilCartons = saison.configuration.seuilCartonsJaunes;

    // Créer le carton jaune
    const cartonJaune = await Discipline.create({
      type: 'Carton Jaune',
      cible: 'Joueur',
      joueurId,
      clubId,
      matchId,
      saisonId,
      raison,
      dateIncident: new Date(),
      matchesSuspendus: 0,
      matchesRestants: 0,
      statut: 'Validée',
      historique: [{
        action: 'Carton jaune enregistré',
        utilisateur: 'Système',
        date: new Date(),
      }],
    });

    // Compter le total de cartons jaunes du joueur dans la saison
    const totalCartonsJaunes = await Discipline.countDocuments({
      joueurId,
      saisonId,
      type: 'Carton Jaune',
      statut: { $in: ['Validée', 'Terminée'] },
    });

    // Si le seuil est atteint, créer une suspension automatique
    if (totalCartonsJaunes >= seuilCartons && totalCartonsJaunes % seuilCartons === 0) {
      await Discipline.create({
        type: 'Suspension Manuelle',
        cible: 'Joueur',
        joueurId,
        clubId,
        saisonId,
        raison: `Accumulation de ${seuilCartons} cartons jaunes`,
        dateIncident: new Date(),
        matchesSuspendus: 1,
        matchesRestants: 1,
        dateDebut: new Date(),
        statut: 'En Cours',
        historique: [{
          action: 'Suspension automatique créée',
          utilisateur: 'Système',
          date: new Date(),
          commentaire: `Seuil de ${seuilCartons} cartons jaunes atteint`,
        }],
      });

      // Mettre à jour les stats du joueur
      await Joueur.findByIdAndUpdate(joueurId, {
        $inc: { 'stats.cartonsJaunes': 1 },
      });

      return {
        carton: cartonJaune,
        suspensionCreee: true,
        message: `Suspension automatique d'1 match créée (${seuilCartons} cartons jaunes)`,
      };
    }

    // Mettre à jour les stats du joueur
    await Joueur.findByIdAndUpdate(joueurId, {
      $inc: { 'stats.cartonsJaunes': 1 },
    });

    return {
      carton: cartonJaune,
      suspensionCreee: false,
      message: `Carton jaune enregistré (${totalCartonsJaunes}/${seuilCartons})`,
    };
  }

  /**
   * Traite un carton rouge et crée une suspension automatique
   */
  static async traiterCartonRouge(
    joueurId: string,
    clubId: string,
    matchId: string,
    saisonId: string,
    raison: string,
    matchesSuspension?: number
  ) {
    await connectDB();

    // Récupérer la configuration de la saison
    const saison = await Saison.findById(saisonId);
    if (!saison) throw new Error('Saison non trouvée');

    const nbMatchsSuspension = matchesSuspension || saison.configuration.suspensionCartonRouge;

    // Créer le carton rouge
    const cartonRouge = await Discipline.create({
      type: 'Carton Rouge',
      cible: 'Joueur',
      joueurId,
      clubId,
      matchId,
      saisonId,
      raison,
      dateIncident: new Date(),
      matchesSuspendus: nbMatchsSuspension,
      matchesRestants: nbMatchsSuspension,
      dateDebut: new Date(),
      statut: 'En Cours',
      historique: [{
        action: 'Carton rouge et suspension automatique',
        utilisateur: 'Système',
        date: new Date(),
        commentaire: `Suspension de ${nbMatchsSuspension} match(s)`,
      }],
    });

    // Mettre à jour les stats du joueur
    await Joueur.findByIdAndUpdate(joueurId, {
      $inc: { 'stats.cartonsRouges': 1 },
    });

    return {
      carton: cartonRouge,
      message: `Carton rouge + suspension de ${nbMatchsSuspension} match(s)`,
    };
  }

  /**
   * Traite une suspension de staff (entraîneur, adjoint, etc.)
   */
  static async traiterSuspensionStaff(
    staffId: string,
    clubId: string,
    matchId: string,
    saisonId: string,
    raison: string,
    matchesSuspension: number
  ) {
    await connectDB();

    const suspension = await Discipline.create({
      type: 'Suspension Manuelle',
      cible: 'Staff',
      staffId,
      clubId,
      matchId,
      saisonId,
      raison,
      dateIncident: new Date(),
      matchesSuspendus: matchesSuspension,
      matchesRestants: matchesSuspension,
      dateDebut: new Date(),
      statut: 'En Cours',
      historique: [{
        action: 'Suspension staff créée',
        utilisateur: 'Système',
        date: new Date(),
      }],
    });

    return {
      suspension,
      message: `Suspension de ${matchesSuspension} match(s) créée`,
    };
  }

  /**
   * Décrémenter les matches restants après un match
   */
  static async decrementerSuspensions(matchId: string, clubId: string) {
    await connectDB();

    const suspensionsActives = await Discipline.find({
      clubId,
      statut: 'En Cours',
      matchesRestants: { $gt: 0 },
    });

    for (const suspension of suspensionsActives) {
      suspension.matchesRestants -= 1;

      if (suspension.matchesRestants <= 0) {
        suspension.statut = 'Terminée';
        suspension.dateFin = new Date();
      }

      suspension.historique.push({
        action: 'Match de suspension purgé',
        utilisateur: 'Système',
        date: new Date(),
        commentaire: `Matches restants: ${suspension.matchesRestants}`,
      });

      await suspension.save();
    }

    return suspensionsActives.length;
  }

  /**
   * Vérifie si un joueur est suspendu
   */
  static async isJoueurSuspendu(joueurId: string): Promise<boolean> {
    await connectDB();

    const count = await Discipline.countDocuments({
      joueurId,
      statut: 'En Cours',
      matchesRestants: { $gt: 0 },
    });

    return count > 0;
  }

  /**
   * Vérifie si un membre du staff est suspendu
   */
  static async isStaffSuspendu(staffId: string): Promise<boolean> {
    await connectDB();

    const count = await Discipline.countDocuments({
      staffId,
      statut: 'En Cours',
      matchesRestants: { $gt: 0 },
    });

    return count > 0;
  }

  /**
   * Obtenir toutes les suspensions actives d'un club
   */
  static async getSuspensionsActives(clubId: string) {
    await connectDB();

    return await Discipline.find({
      clubId,
      statut: 'En Cours',
      matchesRestants: { $gt: 0 },
    })
      .populate('joueurId staffId')
      .sort({ dateDebut: -1 });
  }

  /**
   * Obtenir la disponibilité des joueurs pour un match
   */
  static async getPlayerAvailabilityForMatch(
    matchId: string,
    homeClubId: string,
    awayClubId: string,
    saisonId: string
  ) {
    await connectDB();

    const saison = await Saison.findById(saisonId);
    if (!saison) throw new Error('Saison non trouvée');
    const seuilCartons = saison.configuration.seuilCartonsJaunes;

    // Récupérer tous les joueurs des deux clubs
    const [homePlayers, awayPlayers] = await Promise.all([
      Joueur.find({ clubId: homeClubId }).lean(),
      Joueur.find({ clubId: awayClubId }).lean(),
    ]);

    // Récupérer toutes les suspensions actives pour les deux clubs
    const suspensions = await Discipline.find({
      $or: [{ clubId: homeClubId }, { clubId: awayClubId }],
      cible: 'Joueur',
      statut: 'En Cours',
      matchesRestants: { $gt: 0 },
    })
      .populate('joueurId', 'nom prenom')
      .lean();

    // Récupérer tous les cartons jaunes de la saison pour calculer les accumulations
    const yellowCards = await Discipline.find({
      $or: [{ clubId: homeClubId }, { clubId: awayClubId }],
      type: 'Carton Jaune',
      saisonId,
      statut: { $in: ['Validée', 'Terminée'] },
    })
      .populate('joueurId', 'nom prenom')
      .lean();

    // Compter les cartons jaunes par joueur
    const yellowCardCounts: Record<string, number> = {};
    yellowCards.forEach((card: any) => {
      if (card.joueurId) {
        const playerId = card.joueurId._id.toString();
        yellowCardCounts[playerId] = (yellowCardCounts[playerId] || 0) + 1;
      }
    });

    // Créer un map des suspensions par joueur
    const suspensionMap: Record<string, any> = {};
    suspensions.forEach((suspension: any) => {
      if (suspension.joueurId) {
        const playerId = suspension.joueurId._id.toString();
        if (!suspensionMap[playerId]) {
          suspensionMap[playerId] = [];
        }
        suspensionMap[playerId].push({
          type: suspension.type,
          matchesRestants: suspension.matchesRestants,
          raison: suspension.raison,
        });
      }
    });

    // Fonction pour déterminer la disponibilité d'un joueur
    const getPlayerAvailability = (player: any, clubId: string) => {
      const playerId = player._id.toString();
      const playerSuspensions = suspensionMap[playerId] || [];
      const yellowCount = yellowCardCounts[playerId] || 0;

      // Vérifier les suspensions actives
      if (playerSuspensions.length > 0) {
        const activeSuspension = playerSuspensions[0];
        return {
          available: false,
          reason: activeSuspension.type === 'Carton Rouge' 
            ? 'Carton Rouge' 
            : activeSuspension.type === 'Suspension Manuelle'
            ? 'Accumulation de cartons jaunes'
            : activeSuspension.raison,
          remainingMatches: activeSuspension.matchesRestants,
          yellowCards: yellowCount,
        };
      }

      // Vérifier l'accumulation de cartons jaunes (si le joueur atteint exactement le seuil)
      // Note: Les suspensions sont créées automatiquement lors du traitement du carton jaune
      // Si on arrive ici sans suspension active, c'est que le seuil n'est pas encore atteint
      // ou que la suspension a déjà été purgée

      return {
        available: true,
        reason: null,
        remainingMatches: 0,
        yellowCards: yellowCount,
      };
    };

    // Traiter les joueurs des deux équipes
    const homeAvailability = homePlayers.map((player) => ({
      player: {
        _id: player._id.toString(),
        nom: player.nom,
        prenom: player.prenom,
        numeroMaillot: player.numeroMaillot,
      },
      club: 'home',
      ...getPlayerAvailability(player, homeClubId),
    }));

    const awayAvailability = awayPlayers.map((player) => ({
      player: {
        _id: player._id.toString(),
        nom: player.nom,
        prenom: player.prenom,
        numeroMaillot: player.numeroMaillot,
      },
      club: 'away',
      ...getPlayerAvailability(player, awayClubId),
    }));

    return {
      home: {
        available: homeAvailability.filter((p) => p.available),
        unavailable: homeAvailability.filter((p) => !p.available),
      },
      away: {
        available: awayAvailability.filter((p) => p.available),
        unavailable: awayAvailability.filter((p) => !p.available),
      },
    };
  }
}

export default DisciplineService;

