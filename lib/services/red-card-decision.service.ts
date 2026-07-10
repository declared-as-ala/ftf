import mongoose from 'mongoose';
import Suspension from '../models/Suspension';
import SuspensionServiceEntry from '../models/SuspensionServiceEntry';
import Match from '../models/Match';
import AuditService from './audit.service';

/**
 * RedCardDecisionService
 *
 * R-005: provisional → final decision.
 * Decision fields: total matches, scope, already-missed deduction.
 * Never assume 1 match. Admin records the official decision.
 */
export class RedCardDecisionService {
  static async recordDecision(
    suspensionId: string | mongoose.Types.ObjectId,
    {
      totalMatches,
      scope,
      competitionId,
      decisionDate,
      decisionReference,
      decisionReason,
      matchesMissedPreDecision,
      actorId,
      organizationId,
    }: {
      totalMatches: number;
      scope: 'ALL_COMPETITIONS' | 'SAME_COMPETITION' | 'SAME_CATEGORY';
      competitionId?: string;
      decisionDate: Date;
      decisionReference: string;
      decisionReason: string;
      matchesMissedPreDecision: number;
      actorId: string;
      organizationId: string;
    }
  ) {
    const suspension = await Suspension.findOne({
      _id: suspensionId,
      organizationId,
    });
    if (!suspension) throw new Error('Suspension introuvable');
    if (suspension.status !== 'PROVISIONAL' && suspension.status !== 'ACTIVE') {
      throw new Error('Cette suspension n\'est pas en attente de décision');
    }

    const before = {
      status: suspension.status,
      matchesSuspended: suspension.matchesSuspended,
      matchesRemaining: suspension.matchesRemaining,
    };

    // Compute remaining after deducting already-missed matches
    const deduction = Math.min(matchesMissedPreDecision, totalMatches);
    const remaining = Math.max(0, totalMatches - deduction);

    suspension.suspensionType = 'RED_CARD_FINAL';
    suspension.status = remaining <= 0 ? 'SERVED' : 'ACTIVE';
    suspension.scope = scope;
    suspension.competitionId = competitionId ? new mongoose.Types.ObjectId(competitionId) : undefined;
    suspension.matchesSuspended = totalMatches;
    suspension.matchesMissedPreDecision = deduction;
    suspension.matchesServed = deduction;
    suspension.matchesRemaining = remaining;
    suspension.decisionDate = decisionDate;
    suspension.decisionReference = decisionReference;
    suspension.decisionReason = decisionReason;

    await suspension.save();

    await AuditService.log({
      actor: { id: actorId, role: 'FTF_ADMIN' },
      action: 'RED_CARD_DECISION_RECORDED',
      entityType: 'Suspension',
      entityId: suspensionId,
      before,
      after: {
        status: suspension.status,
        matchesSuspended: totalMatches,
        matchesRemaining: remaining,
        deduction,
      },
      organizationId,
    });

    return suspension;
  }

  static async cancelSuspension(
    suspensionId: string | mongoose.Types.ObjectId,
    reason: string,
    actorId: string,
    organizationId: string
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Une raison (min 5 caractères) est obligatoire');
    }

    const suspension = await Suspension.findOne({ _id: suspensionId, organizationId });
    if (!suspension) throw new Error('Suspension introuvable');
    if (suspension.status === 'SERVED') {
      throw new Error('Impossible d\'annuler une suspension déjà purgée');
    }

    const before = { status: suspension.status };
    suspension.status = 'CANCELLED';
    suspension.cancelledReason = reason;
    suspension.cancelledBy = new mongoose.Types.ObjectId(actorId);
    suspension.cancelledAt = new Date();
    await suspension.save();

    await AuditService.log({
      actor: { id: actorId, role: 'FTF_ADMIN' },
      action: 'SUSPENSION_CANCELLED',
      entityType: 'Suspension',
      entityId: suspensionId,
      before,
      after: { status: 'CANCELLED', reason },
      organizationId,
    });

    return suspension;
  }
}

export default RedCardDecisionService;
