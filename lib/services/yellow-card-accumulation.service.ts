import mongoose from 'mongoose';
import DisciplinaryCard from '../models/DisciplinaryCard';
import Suspension from '../models/Suspension';
import { NotificationService } from './notification.service';

/**
 * YellowCardAccumulationService
 *
 * R-001: 3 warnings in 3 official matches → automatic 1-match suspension
 * R-002: Only official match yellows count
 * R-003: Suspension applies to first applicable official match after the last warning
 * R-004: Season-end clearance
 * R-006: SECOND_YELLOW_RED — the yellow is absorbed; only DIRECT_RED leaves the in-match
 *         warning active in accumulation
 *
 * All writes happen within the caller's session (inside finalization transaction).
 */
export class YellowCardAccumulationService {
  /**
   * Process a yellow card event from a match event.
   * Must be called with the already-loaded ruleSet.
   * Returns the created card (and suspension if threshold reached).
   */
  static async processYellow(
    {
      matchId,
      joueurId,
      clubId,
      competitionId,
      saisonId,
      roundId,
      organizationId,
      minute,
      notes,
      ruleSetThreshold,
      ruleSetSuspensionMatches,
      ruleSetScope,
      matchIsOfficial,
      sourceEventId,
    }: {
      matchId: string | mongoose.Types.ObjectId;
      joueurId: string | mongoose.Types.ObjectId;
      clubId: string | mongoose.Types.ObjectId;
      competitionId: string | mongoose.Types.ObjectId;
      saisonId: string | mongoose.Types.ObjectId;
      roundId?: string | mongoose.Types.ObjectId;
      organizationId: string | mongoose.Types.ObjectId;
      minute?: number;
      notes?: string;
      ruleSetThreshold: number;
      ruleSetSuspensionMatches: number;
      ruleSetScope: string;
      matchIsOfficial: boolean;
      sourceEventId?: string | mongoose.Types.ObjectId;
    },
    session: mongoose.ClientSession
  ) {
    // Count current ACTIVE yellows for this player in this season (official matches only)
    const activeCount = await DisciplinaryCard.countDocuments({
      organizationId,
      joueurId,
      saisonId,
      cardType: 'YELLOW',
      accumulationStatus: 'ACTIVE',
    }).session(session);

    const newCount = matchIsOfficial ? activeCount + 1 : 0;

    // Create the card
    const [card] = await DisciplinaryCard.create(
      [
        {
          organizationId,
          matchId,
          competitionId,
          saisonId,
          roundId,
          joueurId,
          clubId,
          cardType: 'YELLOW',
          minute,
          // R-002: les cartons de matchs amicaux n'entrent jamais dans l'accumulation
          accumulationStatus: matchIsOfficial ? 'ACTIVE' : 'NOT_OFFICIAL',
          accumulationCount: newCount,
          notes,
          sourceEventId,
        },
      ],
      { session }
    );

    let suspension: any = null;

    // R-001: Check if threshold reached
    if (matchIsOfficial && newCount >= ruleSetThreshold && newCount % ruleSetThreshold === 0) {
      // Find all ACTIVE yellows for this player in this season (including this one)
      const activeCards = await DisciplinaryCard.find({
        organizationId,
        joueurId,
        saisonId,
        cardType: 'YELLOW',
        accumulationStatus: 'ACTIVE',
      })
        .session(session)
        .sort({ createdAt: 1 })
        .select('_id');

      // The latest N cards (= threshold) are consumed
      const toConsume = activeCards.slice(-ruleSetThreshold).map((c) => c._id);

      // Create suspension first so we have the ID
      const scope = ruleSetScope || 'ALL_OFFICIAL_COMPETITIONS';
      const [susp] = await Suspension.create(
        [
          {
            organizationId,
            joueurId,
            clubId,
            sourceMatchId: matchId,
            sourceCardId: card._id,
            sourceSeasonId: saisonId,
            suspensionType: 'YELLOW_ACCUMULATION',
            status: 'ACTIVE',
            scope,
            competitionId: scope === 'SAME_COMPETITION' ? competitionId : undefined,
            matchesSuspended: ruleSetSuspensionMatches,
            matchesServed: 0,
            matchesRemaining: ruleSetSuspensionMatches,
            createdBy: 'SYSTEM',
          },
        ],
        { session }
      );

      suspension = susp;

      // Mark consumed cards — includes the newly created one
      await DisciplinaryCard.updateMany(
        { _id: { $in: toConsume } },
        {
          accumulationStatus: 'CONSUMED_BY_SUSPENSION',
          linkedSuspensionId: susp._id,
        },
        { session }
      );

      await NotificationService.notify(
        {
          organizationId: organizationId.toString(),
          recipientClubId: clubId.toString(),
          type: 'SUSPENSION_CREATED',
          subject: 'Suspension automatique — accumulation de cartons jaunes',
          body: `Un joueur a atteint le seuil de ${ruleSetThreshold} cartons jaunes. Une suspension de ${ruleSetSuspensionMatches} match(s) a été créée automatiquement.`,
          dedupeKey: `SUSPENSION_CREATED:${susp._id}`,
          entityType: 'Suspension',
          entityId: susp._id.toString(),
        },
        session
      );
    }

    return { card, suspension };
  }

  /**
   * Process a SECOND_YELLOW_RED or DIRECT_RED card.
   * R-005: creates a PROVISIONAL suspension.
   * R-006: SECOND_YELLOW_RED absorbs in-match yellows.
   */
  static async processRedCard(
    {
      matchId,
      joueurId,
      clubId,
      competitionId,
      saisonId,
      roundId,
      organizationId,
      cardType,
      minute,
      notes,
      matchIsOfficial,
      sourceEventId,
    }: {
      matchId: string | mongoose.Types.ObjectId;
      joueurId: string | mongoose.Types.ObjectId;
      clubId: string | mongoose.Types.ObjectId;
      competitionId: string | mongoose.Types.ObjectId;
      saisonId: string | mongoose.Types.ObjectId;
      roundId?: string | mongoose.Types.ObjectId;
      organizationId: string | mongoose.Types.ObjectId;
      cardType: 'SECOND_YELLOW_RED' | 'DIRECT_RED';
      minute?: number;
      notes?: string;
      matchIsOfficial: boolean;
      sourceEventId?: string | mongoose.Types.ObjectId;
    },
    session: mongoose.ClientSession
  ) {
    // Create the card record
    const [card] = await DisciplinaryCard.create(
      [
        {
          organizationId,
          matchId,
          competitionId,
          saisonId,
          roundId,
          joueurId,
          clubId,
          cardType,
          minute,
          accumulationStatus: 'ACTIVE', // Not consumed — red card suspensions are separate
          notes,
          sourceEventId,
        },
      ],
      { session }
    );

    // R-006: SECOND_YELLOW_RED — absorb same-match ACTIVE yellow so it doesn't
    // continue in accumulation
    if (cardType === 'SECOND_YELLOW_RED') {
      const sameMatchYellow = await DisciplinaryCard.findOne({
        organizationId,
        joueurId,
        matchId,
        cardType: 'YELLOW',
        accumulationStatus: 'ACTIVE',
      }).session(session);

      if (sameMatchYellow) {
        await DisciplinaryCard.findByIdAndUpdate(
          sameMatchYellow._id,
          { accumulationStatus: 'CONSUMED_BY_SUSPENSION' },
          { session }
        );
      }
    }

    // R-005: Create provisional suspension (player stays suspended until decision)
    const [suspension] = await Suspension.create(
      [
        {
          organizationId,
          joueurId,
          clubId,
          sourceMatchId: matchId,
          sourceCardId: card._id,
          sourceSeasonId: saisonId,
          suspensionType: 'RED_CARD_PROVISIONAL',
          status: 'PROVISIONAL',
          scope: 'ALL_COMPETITIONS',
          matchesSuspended: 1,   // Placeholder — updated when decision is recorded
          matchesServed: 0,
          matchesRemaining: 1,   // Placeholder — player stays out until admin decision
          createdBy: 'SYSTEM',
        },
      ],
      { session }
    );

    // Update the card to link to the provisional suspension
    await DisciplinaryCard.findByIdAndUpdate(
      card._id,
      { linkedSuspensionId: suspension._id },
      { session }
    );

    await NotificationService.notify(
      {
        organizationId: organizationId.toString(),
        type: 'RED_CARD_DECISION_REQUIRED',
        subject: 'Carton rouge — décision disciplinaire requise',
        body: `Un carton rouge (${cardType}) a été homologué. Une décision disciplinaire est requise.`,
        dedupeKey: `RED_CARD_DECISION_REQUIRED:${suspension._id}`,
        entityType: 'Suspension',
        entityId: suspension._id.toString(),
      },
      session
    );

    return { card, suspension };
  }

  /**
   * R-004 — End-of-season clearance operation.
   * Clears all ACTIVE yellow cards for a season.
   * Auditable: returns count of cards cleared.
   * NEVER deletes cards.
   */
  static async clearSeasonYellows(
    saisonId: string | mongoose.Types.ObjectId,
    clearedBy: string | mongoose.Types.ObjectId,
    organizationId: string | mongoose.Types.ObjectId
  ) {
    const result = await DisciplinaryCard.updateMany(
      {
        saisonId,
        organizationId,
        cardType: 'YELLOW',
        accumulationStatus: 'ACTIVE',
      },
      {
        accumulationStatus: 'CLEARED_AT_SEASON_END',
        clearedBy,
        clearedAt: new Date(),
      }
    );
    return result.modifiedCount;
  }
}

export default YellowCardAccumulationService;
