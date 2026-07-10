import Match from '../models/Match';
import Competition from '../models/Competition';
import Discipline from '../models/Discipline';
import DisciplineService from './discipline.service';
import connectDB from '../db';

/**
 * Service de gestion des matchs
 */
export class MatchService {
  /**
   * Homologuer un match et traiter les événements disciplinaires
   */
  static async homologuerMatch(matchId: string, userId: string) {
    await connectDB();

    const match = await Match.findById(matchId);
    if (!match) throw new Error('Match non trouvé');

    if (match.homologue) {
      throw new Error('Match déjà homologué');
    }

    // Traiter les cartons du match
    for (const event of match.evenements) {
      if (event.type === 'Carton Jaune' && event.joueurId) {
        const clubId = event.equipe === 'home' ? match.homeClubId : match.awayClubId;
        
        await DisciplineService.traiterCartonJaune(
          event.joueurId.toString(),
          clubId.toString(),
          matchId,
          match.saisonId.toString(),
          event.description || 'Carton jaune'
        );
      } else if (event.type === 'Carton Rouge' && event.joueurId) {
        const clubId = event.equipe === 'home' ? match.homeClubId : match.awayClubId;
        
        await DisciplineService.traiterCartonRouge(
          event.joueurId.toString(),
          clubId.toString(),
          matchId,
          match.saisonId.toString(),
          event.description || 'Carton rouge'
        );
      }
    }

    // Marquer le match comme homologué
    match.homologue = true;
    match.validePar = userId as any;
    match.dateValidation = new Date();
    match.statut = 'Terminé';

    await match.save();

    // Mettre à jour le classement
    await this.updateClassement(match.competitionId.toString(), match);

    // Décrémenter les suspensions pour les deux clubs
    await DisciplineService.decrementerSuspensions(matchId, match.homeClubId.toString());
    await DisciplineService.decrementerSuspensions(matchId, match.awayClubId.toString());

    return match;
  }

  /**
   * Mettre à jour le classement d'une compétition
   */
  static async updateClassement(competitionId: string, match: any) {
    const competition = await Competition.findById(competitionId);
    if (!competition || competition.type !== 'Championnat') return;

    const homeIndex = competition.classement.findIndex(
      (c) => c.clubId.toString() === match.homeClubId.toString()
    );
    const awayIndex = competition.classement.findIndex(
      (c) => c.clubId.toString() === match.awayClubId.toString()
    );

    if (homeIndex === -1 || awayIndex === -1) return;

    const homeClub = competition.classement[homeIndex];
    const awayClub = competition.classement[awayIndex];

    // Mettre à jour les statistiques
    homeClub.matchesJoues += 1;
    awayClub.matchesJoues += 1;

    homeClub.butsMarques += match.scoreHome;
    homeClub.butsEncaisses += match.scoreAway;
    awayClub.butsMarques += match.scoreAway;
    awayClub.butsEncaisses += match.scoreHome;

    // Déterminer le résultat
    if (match.scoreHome > match.scoreAway) {
      // Victoire domicile
      homeClub.victoires += 1;
      homeClub.points += competition.reglementPoints.victoire;
      awayClub.defaites += 1;
      awayClub.points += competition.reglementPoints.defaite;
    } else if (match.scoreHome < match.scoreAway) {
      // Victoire extérieur
      awayClub.victoires += 1;
      awayClub.points += competition.reglementPoints.victoire;
      homeClub.defaites += 1;
      homeClub.points += competition.reglementPoints.defaite;
    } else {
      // Match nul
      homeClub.nuls += 1;
      awayClub.nuls += 1;
      homeClub.points += competition.reglementPoints.nul;
      awayClub.points += competition.reglementPoints.nul;
    }

    // Calculer la différence de buts
    homeClub.difference = homeClub.butsMarques - homeClub.butsEncaisses;
    awayClub.difference = awayClub.butsMarques - awayClub.butsEncaisses;

    // Trier le classement
    competition.classement.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.difference !== a.difference) return b.difference - a.difference;
      return b.butsMarques - a.butsMarques;
    });

    // Mettre à jour les positions
    competition.classement.forEach((club, index) => {
      club.position = index + 1;
    });

    await competition.save();
  }

  /**
   * Obtenir les prochains matchs d'un club
   */
  static async getProchainsMatchs(clubId: string, limit: number = 5) {
    await connectDB();

    return await Match.find({
      $or: [{ homeClubId: clubId }, { awayClubId: clubId }],
      date: { $gte: new Date() },
      statut: 'Programmé',
    })
      .populate('homeClubId awayClubId competitionId')
      .sort({ date: 1 })
      .limit(limit);
  }

  /**
   * Obtenir l'historique des matchs d'un club
   */
  static async getHistoriqueMatchs(clubId: string, limit: number = 10) {
    await connectDB();

    return await Match.find({
      $or: [{ homeClubId: clubId }, { awayClubId: clubId }],
      statut: 'Terminé',
    })
      .populate('homeClubId awayClubId competitionId')
      .sort({ date: -1 })
      .limit(limit);
  }
}

export default MatchService;

