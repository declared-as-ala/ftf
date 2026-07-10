import mongoose from 'mongoose';
import Competition from '../models/Competition';
import Round from '../models/Round';
import Match from '../models/Match';
import Club from '../models/Club';
import connectDB from '../db';
import AuditService from './audit.service';

export interface GenerationOptions {
  competitionId: string | mongoose.Types.ObjectId;
  organizationId: string | mongoose.Types.ObjectId;
  actorId: string;
  doubleLeg?: boolean; // true = home/away, false = single leg
  startDate?: Date;
}

export class ScheduleGenerationService {
  /**
   * Génère automatiquement le calendrier des rencontres (fixtures) pour une compétition
   * en utilisant l'algorithme de Berger (Round-Robin).
   * 
   * Caractéristiques :
   *   - Enregistrement atomique & transactionnel (session MongoDB).
   *   - Supporte Simple Aller (single) ou Aller-Retour (double leg).
   *   - Équilibre l'alternance Domicile/Extérieur pour chaque club.
   *   - Gère le repos (BYE) si le nombre d'équipes est impair.
   *   - Verrouille la génération si des matchs existent déjà pour la compétition.
   */
  static async generateCalendar(options: GenerationOptions) {
    const { competitionId, organizationId, actorId, doubleLeg = true, startDate = new Date() } = options;

    await connectDB();

    // 1. Guard : Vérifier s'il y a déjà des matchs programmés
    const hasMatches = await Match.exists({ competitionId });
    if (hasMatches) {
      throw new Error('Un calendrier existe déjà pour cette compétition');
    }

    // 2. Récupérer la compétition
    const competition = await Competition.findOne({ _id: competitionId, organizationId });
    if (!competition) {
      throw new Error('Compétition introuvable');
    }

    const clubIds = competition.clubsParticipants || [];
    if (clubIds.length < 2) {
      throw new Error('Il faut au moins 2 clubs pour générer un calendrier');
    }

    // Récupérer les stades des clubs pour affectation automatique
    const clubs = await Club.find({ _id: { $in: clubIds }, organizationId }).lean();
    const clubMap = new Map(clubs.map((c) => [c._id.toString(), c]));

    // 3. Préparer la liste pour l'algorithme de Berger
    const list = [...clubIds.map((id) => id.toString())];
    const isOdd = list.length % 2 !== 0;
    if (isOdd) {
      list.push('BYE'); // Ajout d'une équipe fictive pour le repos
    }

    const N = list.length;
    const roundsCountSingle = N - 1;
    const totalRounds = doubleLeg ? roundsCountSingle * 2 : roundsCountSingle;

    // Déterminer les appariements pour chaque journée (Aller simple)
    const pairingsPerRound: { home: string; away: string }[][] = [];
    const teams = [...list];

    for (let r = 0; r < roundsCountSingle; r++) {
      const pairings: { home: string; away: string }[] = [];
      
      // Pivot : teams[0] contre teams[N-1]
      const t1 = teams[0];
      const t2 = teams[N - 1];
      if (t1 !== 'BYE' && t2 !== 'BYE') {
        const isHome = r % 2 === 0;
        pairings.push({
          home: isHome ? t1 : t2,
          away: isHome ? t2 : t1,
        });
      }

      // Autres paires
      for (let i = 1; i < N / 2; i++) {
        const u = teams[i];
        const v = teams[N - 1 - i];
        if (u !== 'BYE' && v !== 'BYE') {
          const isHome = i % 2 === 0;
          pairings.push({
            home: isHome ? u : v,
            away: isHome ? v : u,
          });
        }
      }

      pairingsPerRound.push(pairings);

      // Rotation circulaire (garde le pivot teams[0] fixe)
      const rest = teams.slice(1);
      const last = rest.pop()!;
      rest.unshift(last);
      teams.splice(1, N - 1, ...rest);
    }

    // 4. Lancer une transaction MongoDB pour assurer la consistance
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const generatedRounds: any[] = [];
      const generatedMatches: any[] = [];

      for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
        const roundNumber = roundIdx + 1;
        const isSecondLeg = roundIdx >= roundsCountSingle;
        const pairingRoundIdx = roundIdx % roundsCountSingle;

        // Intervalle de 7 jours entre chaque journée
        const roundStartDate = new Date(startDate.getTime() + roundIdx * 7 * 24 * 60 * 60 * 1000);
        roundStartDate.setHours(14, 0, 0, 0); // Début par défaut à 14h00
        const roundEndDate = new Date(roundStartDate.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 jours pour la journée

        // Créer l'objet Round
        const round = new Round({
          organizationId,
          competitionId,
          saisonId: competition.saisonId,
          number: roundNumber,
          name: `Journée ${roundNumber}`,
          dateDebut: roundStartDate,
          dateFin: roundEndDate,
          status: 'SCHEDULED',
          active: true,
        });
        await round.save({ session });
        generatedRounds.push(round);

        // Créer les matchs rattachés à cette journée
        const pairings = pairingsPerRound[pairingRoundIdx];
        for (const pairing of pairings) {
          // Si phase retour (Second Leg), on inverse Domicile et Extérieur
          const homeId = isSecondLeg ? pairing.away : pairing.home;
          const awayId = isSecondLeg ? pairing.home : pairing.away;

          const homeClub = clubMap.get(homeId);

          const match = new Match({
            organizationId,
            saisonId: competition.saisonId,
            competitionId,
            roundId: round._id,
            journee: roundNumber,
            homeClubId: new mongoose.Types.ObjectId(homeId),
            awayClubId: new mongoose.Types.ObjectId(awayId),
            date: roundStartDate,
            stade: homeClub?.stade || 'Stade à déterminer',
            scoreHome: 0,
            scoreAway: 0,
            statut: 'Programmé',
            evenements: [],
            homologue: false,
          });

          await match.save({ session });
          generatedMatches.push(match._id);
        }
      }

      // Relier les matchs générés à la compétition
      competition.matchs = [...(competition.matchs || []), ...generatedMatches];
      competition.status = 'SCHEDULED';
      await competition.save({ session });

      // Enregistrer l'opération dans le journal d'audit
      await AuditService.log({
        actor: { id: actorId, role: 'FTF_ADMIN' },
        action: 'CALENDAR_GENERATED',
        entityType: 'Competition',
        entityId: competitionId,
        after: {
          doubleLeg,
          roundsGenerated: generatedRounds.length,
          matchesGenerated: generatedMatches.length,
        },
        organizationId,
      });

      await session.commitTransaction();
      session.endSession();

      return {
        roundsCount: generatedRounds.length,
        matchesCount: generatedMatches.length,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

export default ScheduleGenerationService;
