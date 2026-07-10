import mongoose from 'mongoose';
import DisciplinaryRuleSet from '../models/DisciplinaryRuleSet';
import { YellowCardAccumulationService } from './yellow-card-accumulation.service';
import type { IEvenementMatch } from '../models/Match';

/**
 * DisciplineEngine — orchestrator called INSIDE the finalization transaction.
 *
 * Processes each card event from the match's evenements array:
 *  - Carton Jaune → YellowCardAccumulationService.processYellow()
 *  - Carton Rouge / Carton Jaune Rouge → YellowCardAccumulationService.processRedCard()
 *
 * Serving (SuspensionService.processServingForMatch) runs AFTER commit —
 * it is post-transaction to avoid holding the session open too long.
 */
export class DisciplineEngine {
  static async processMatchCards(
    match: {
      _id: any;
      competitionId: any;
      saisonId: any;
      roundId?: any;
      organizationId: any;
      isOfficial: boolean;
      homeClubId: any;
      awayClubId: any;
      evenements: IEvenementMatch[];
    },
    session: mongoose.ClientSession
  ) {
    // Fetch the disciplinary rule set — prefer the season-specific one,
    // fall back to the most recent active rule set for the organization
    const ruleSet =
      (await DisciplinaryRuleSet.findOne({
        organizationId: match.organizationId,
        seasonId: match.saisonId,
        active: true,
      })
        .sort({ version: -1 })
        .session(session)
        .lean()) ||
      (await DisciplinaryRuleSet.findOne({
        organizationId: match.organizationId,
      })
        .sort({ version: -1 })
        .session(session)
        .lean());

    const threshold = ruleSet?.yellowCardThreshold ?? 3;
    const suspensionMatches = ruleSet?.yellowCardSuspensionMatches ?? 1;
    const scope = (ruleSet as any)?.suspensionScope ?? 'ALL_OFFICIAL_COMPETITIONS';
    const matchIsOfficial = match.isOfficial;

    const results: {
      cardType: string;
      joueurId: string;
      cardId?: string;
      suspensionId?: string;
    }[] = [];

    for (const evt of match.evenements) {
      if (!evt.joueurId) continue;

      const joueurIdStr = evt.joueurId.toString();
      const clubId =
        evt.equipe === 'home'
          ? match.homeClubId.toString()
          : match.awayClubId.toString();

      if (evt.type === 'Carton Jaune') {
        const { card, suspension } = await YellowCardAccumulationService.processYellow(
          {
            matchId: match._id,
            joueurId: joueurIdStr,
            clubId,
            competitionId: match.competitionId,
            saisonId: match.saisonId,
            roundId: match.roundId,
            organizationId: match.organizationId,
            minute: evt.minute,
            ruleSetThreshold: threshold,
            ruleSetSuspensionMatches: suspensionMatches,
            ruleSetScope: scope,
            matchIsOfficial,
          },
          session
        );
        results.push({
          cardType: 'YELLOW',
          joueurId: joueurIdStr,
          cardId: card._id.toString(),
          suspensionId: suspension?._id?.toString(),
        });
      } else if (evt.type === 'Carton Rouge' || evt.type === 'Carton Jaune Rouge') {
        const cardType = evt.type === 'Carton Jaune Rouge' ? 'SECOND_YELLOW_RED' : 'DIRECT_RED';
        const { card, suspension } = await YellowCardAccumulationService.processRedCard(
          {
            matchId: match._id,
            joueurId: joueurIdStr,
            clubId,
            competitionId: match.competitionId,
            saisonId: match.saisonId,
            roundId: match.roundId,
            organizationId: match.organizationId,
            cardType,
            minute: evt.minute,
            matchIsOfficial,
          },
          session
        );
        results.push({
          cardType,
          joueurId: joueurIdStr,
          cardId: card._id.toString(),
          suspensionId: suspension?._id?.toString(),
        });
      }
    }

    return results;
  }
}

export default DisciplineEngine;
