import mongoose from 'mongoose';
import MatchOfficialAssignment, { IMatchOfficialAssignment, RefereeOfficialRole } from '../models/MatchOfficialAssignment';
import Match from '../models/Match';
import Arbitre from '../models/Arbitre';
import Club from '../models/Club';
import AuditService from './audit.service';
import NotificationService from './notification.service';
import { ApiError } from '../api';

export class RefereeAssignmentService {
  /**
   * Save draft of referee assignment.
   */
  static async saveDraft(params: {
    matchId: string;
    referees: { refereeId: string; role: RefereeOfficialRole }[];
    notes?: string;
    actorId: string;
    organizationId: string;
  }): Promise<IMatchOfficialAssignment> {
    const { matchId, referees, notes, actorId, organizationId } = params;

    // 1. Validate match
    const match = await Match.findOne({ _id: matchId, organizationId });
    if (!match) {
      throw new ApiError(404, 'Match introuvable');
    }

    // 2. Validate role uniqueness & duplicate referees within match
    const refereeIds = referees.map(r => r.refereeId);
    const uniqueRefereeIds = new Set(refereeIds);
    if (refereeIds.length !== uniqueRefereeIds.size) {
      throw new ApiError(400, 'Un arbitre ne peut pas occuper plusieurs rôles pour le même match');
    }

    const roles = referees.map(r => r.role);
    const uniqueRoles = new Set(roles);
    if (roles.length !== uniqueRoles.size) {
      throw new ApiError(400, 'Chaque rôle d\'officiel ne peut être attribué qu’à un seul arbitre');
    }

    // 3. Validate referee existence & check archived referees
    for (const refItem of referees) {
      const ref = await Arbitre.findOne({ _id: refItem.refereeId, organizationId });
      if (!ref) {
        throw new ApiError(404, `Arbitre avec l'ID ${refItem.refereeId} introuvable`);
      }
      if (ref.status === 'ARCHIVED') {
        throw new ApiError(400, `L'arbitre ${ref.prenom} ${ref.nom} est archivé et ne peut plus être désigné`);
      }
    }

    // 4. Determine version & draft overwrite
    // Find the latest assignment version
    const latest = await MatchOfficialAssignment.findOne({ matchId, organizationId })
      .sort({ version: -1 });

    let assignment: IMatchOfficialAssignment;
    let auditAction: string;
    let before: unknown;

    if (latest && latest.status === 'DRAFT') {
      // Overwrite existing draft
      before = latest.toObject();
      latest.referees = referees.map(r => ({
        refereeId: new mongoose.Types.ObjectId(r.refereeId),
        role: r.role,
      }));
      latest.notes = notes;
      await latest.save();
      assignment = latest;
      auditAction = 'REFEREE_ASSIGNMENT_DRAFT_UPDATED';
    } else {
      // Create new draft with incremented version
      const nextVersion = latest ? latest.version + 1 : 1;
      assignment = await MatchOfficialAssignment.create({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        matchId: new mongoose.Types.ObjectId(matchId),
        referees: referees.map(r => ({
          refereeId: new mongoose.Types.ObjectId(r.refereeId),
          role: r.role,
        })),
        status: 'DRAFT',
        version: nextVersion,
        notes,
      });
      auditAction = 'REFEREE_ASSIGNMENT_DRAFT_CREATED';
    }

    await AuditService.log({
      actor: { id: actorId, role: 'FTF_ADMIN' },
      action: auditAction,
      entityType: 'MatchOfficialAssignment',
      entityId: assignment._id as mongoose.Types.ObjectId,
      before,
      after: assignment.toObject(),
      organizationId,
    });

    return assignment;
  }

  /**
   * Publish a draft assignment.
   */
  static async publish(params: {
    matchId: string;
    version: number;
    reason?: string;
    actorId: string;
    organizationId: string;
  }): Promise<IMatchOfficialAssignment> {
    const { matchId, version, reason, actorId, organizationId } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch draft assignment
      const assignment = await MatchOfficialAssignment.findOne({
        matchId,
        version,
        organizationId,
      }).session(session);

      if (!assignment) {
        throw new ApiError(404, 'Affectation introuvable');
      }
      if (assignment.status !== 'DRAFT') {
        throw new ApiError(400, 'Seule une affectation au statut Brouillon (DRAFT) peut être publiée');
      }

      // 2. Main referee is required to publish
      const mainRefAssigned = assignment.referees.find(r => r.role === 'MAIN');
      if (!mainRefAssigned) {
        throw new ApiError(400, 'Un arbitre principal (MAIN) est obligatoire pour publier l\'affectation');
      }

      const match = await Match.findOne({ _id: matchId, organizationId }).session(session);
      if (!match) {
        throw new ApiError(404, 'Match introuvable');
      }

      const matchDate = match.date;

      // 3. Conflict & Eligibility checks
      for (const assigned of assignment.referees) {
        const referee = await Arbitre.findOne({ _id: assigned.refereeId, organizationId }).session(session);
        if (!referee) {
          throw new ApiError(404, 'Arbitre introuvable');
        }

        // Status check: must be ACTIVE
        if (referee.status !== 'ACTIVE') {
          throw new ApiError(
            400,
            `L'arbitre ${referee.prenom} ${referee.nom} a le statut "${referee.status}" et ne peut pas être désigné`
          );
        }

        // Availability check: check referee.disponibilites for same date
        const matchDayStr = matchDate.toISOString().slice(0, 10);
        const unavailable = referee.disponibilites.some(d => {
          return d.date && d.date.toISOString().slice(0, 10) === matchDayStr && d.disponible === false;
        });
        if (unavailable) {
          throw new ApiError(
            400,
            `L'arbitre ${referee.prenom} ${referee.nom} est déclaré indisponible pour la journée du ${matchDayStr}`
          );
        }

        // Turnaround / Overlap conflict check:
        // Find other active (PUBLISHED) assignments for this referee within 24 hours of matchDate
        const otherAssignments = await MatchOfficialAssignment.find({
          'referees.refereeId': referee._id,
          status: 'PUBLISHED',
          matchId: { $ne: matchId },
          organizationId,
        }).session(session);

        for (const otherAss of otherAssignments) {
          const otherMatch = await Match.findOne({ _id: otherAss.matchId, organizationId }).session(session);
          if (!otherMatch) continue;

          const diffMs = Math.abs(matchDate.getTime() - otherMatch.date.getTime());
          const diffHours = diffMs / (1000 * 60 * 60);

          if (diffHours < 24) {
            const homeClub = await Club.findById(otherMatch.homeClubId).session(session);
            const awayClub = await Club.findById(otherMatch.awayClubId).session(session);
            const otherMatchDesc = homeClub && awayClub ? `${homeClub.nom} vs ${awayClub.nom}` : otherMatch.stade;

            if (diffHours < 3) {
              // Overlapping match conflict
              throw new ApiError(
                409,
                `Conflit horaire : L'arbitre ${referee.prenom} ${referee.nom} est déjà désigné pour le match "${otherMatchDesc}" à la même heure (${otherMatch.date.toLocaleDateString()})`
              );
            } else {
              // Near-time turnaround conflict (less than 24h)
              throw new ApiError(
                409,
                `Délai de récupération insuffisant (turnaround < 24h) : L'arbitre ${referee.prenom} ${referee.nom} est déjà affecté au match "${otherMatchDesc}" le ${otherMatch.date.toLocaleString()}`
              );
            }
          }
        }
      }

      // Check if this is an update of an already published assignment
      const previouslyPublished = await MatchOfficialAssignment.findOne({
        matchId,
        status: 'PUBLISHED',
        organizationId,
        version: { $ne: version },
      }).session(session);

      if (previouslyPublished) {
        // Must provide a reason to update a published assignment
        if (!reason || reason.trim().length < 5) {
          throw new ApiError(400, 'Un motif d\'au moins 5 caractères est requis pour modifier une affectation officielle publiée');
        }
        // Cancel the previous one
        previouslyPublished.status = 'CANCELLED';
        previouslyPublished.cancelReason = 'Remplacé par une nouvelle version';
        previouslyPublished.cancelledAt = new Date();
        previouslyPublished.cancelledBy = new mongoose.Types.ObjectId(actorId);
        await previouslyPublished.save({ session });
      }

      // 4. Update status to PUBLISHED
      const beforeState = assignment.toObject();

      assignment.status = 'PUBLISHED';
      assignment.publishReason = reason;
      assignment.publishedAt = new Date();
      assignment.publishedBy = new mongoose.Types.ObjectId(actorId);
      await assignment.save({ session });

      // 5. Update Match model for legacy compatibility
      match.arbitrePrincipalId = mainRefAssigned.refereeId;
      const assistants = assignment.referees
        .filter(r => r.role !== 'MAIN')
        .map(r => r.refereeId);
      match.assistants = assistants;
      await match.save({ session });

      // 6. Record Audit entry
      const action = version === 1 ? 'REFEREE_ASSIGNMENT_PUBLISHED' : 'REFEREE_ASSIGNMENT_UPDATED';
      await AuditService.logWithSession({
        actor: { id: actorId, role: 'FTF_ADMIN' },
        action,
        entityType: 'MatchOfficialAssignment',
        entityId: assignment._id,
        before: previouslyPublished ? beforeState : undefined,
        after: assignment.toObject(),
        reason,
        organizationId,
      }, session);

      // 7. Notify both clubs
      const homeClub = await Club.findById(match.homeClubId).session(session);
      const awayClub = await Club.findById(match.awayClubId).session(session);
      if (homeClub && awayClub) {
        const type = version === 1 ? 'REFEREE_ASSIGNMENT_PUBLISHED' : 'REFEREE_ASSIGNMENT_UPDATED';
        const mainRef = await Arbitre.findById(mainRefAssigned.refereeId).session(session);
        const mainRefName = mainRef ? `${mainRef.prenom} ${mainRef.nom}` : 'N/A';

        const subject = version === 1 
          ? `Désignation d'arbitre publiée : ${homeClub.nom} - ${awayClub.nom}`
          : `Modification de désignation d'arbitre : ${homeClub.nom} - ${awayClub.nom}`;

        const body = version === 1
          ? `L'arbitre ${mainRefName} a été désigné pour officier votre rencontre du ${matchDate.toLocaleDateString()} contre ${awayClub.nom}.`
          : `La désignation d'arbitre a changé. L'arbitre principal est désormais ${mainRefName} pour le match du ${matchDate.toLocaleDateString()}.`;

        // Send to home club
        await NotificationService.notify({
          organizationId,
          recipientClubId: homeClub._id.toString(),
          type,
          subject,
          body,
          dedupeKey: `${type}:${matchId}:${version}:${homeClub._id}`,
          entityType: 'Match',
          entityId: matchId,
        }, session);

        // Send to away club
        await NotificationService.notify({
          organizationId,
          recipientClubId: awayClub._id.toString(),
          type,
          subject,
          body,
          dedupeKey: `${type}:${matchId}:${version}:${awayClub._id}`,
          entityType: 'Match',
          entityId: matchId,
        }, session);
      }

      await session.commitTransaction();
      return assignment;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Cancel a published assignment.
   */
  static async cancel(params: {
    matchId: string;
    version: number;
    reason: string;
    actorId: string;
    organizationId: string;
  }): Promise<IMatchOfficialAssignment> {
    const { matchId, version, reason, actorId, organizationId } = params;

    if (!reason || reason.trim().length < 5) {
      throw new ApiError(400, 'Un motif d\'au moins 5 caractères est requis pour annuler une affectation officielle');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch published assignment
      const assignment = await MatchOfficialAssignment.findOne({
        matchId,
        version,
        organizationId,
        status: 'PUBLISHED',
      }).session(session);

      if (!assignment) {
        throw new ApiError(404, 'Affectation publiée introuvable');
      }

      const beforeState = assignment.toObject();

      // 2. Set to CANCELLED
      assignment.status = 'CANCELLED';
      assignment.cancelReason = reason;
      assignment.cancelledAt = new Date();
      assignment.cancelledBy = new mongoose.Types.ObjectId(actorId);
      await assignment.save({ session });

      // 3. Clear legacy fields in Match
      const match = await Match.findOne({ _id: matchId, organizationId }).session(session);
      if (match) {
        match.arbitrePrincipalId = undefined;
        match.assistants = [];
        await match.save({ session });
      }

      // 4. Log Audit
      await AuditService.logWithSession({
        actor: { id: actorId, role: 'FTF_ADMIN' },
        action: 'REFEREE_ASSIGNMENT_CANCELLED',
        entityType: 'MatchOfficialAssignment',
        entityId: assignment._id,
        before: beforeState,
        after: assignment.toObject(),
        reason,
        organizationId,
      }, session);

      // 5. Notify both clubs
      if (match) {
        const homeClub = await Club.findById(match.homeClubId).session(session);
        const awayClub = await Club.findById(match.awayClubId).session(session);
        if (homeClub && awayClub) {
          const type = 'REFEREE_ASSIGNMENT_CANCELLED';
          const subject = `Annulation de la désignation d'arbitre : ${homeClub.nom} - ${awayClub.nom}`;
          const body = `La désignation d'arbitre pour votre rencontre du ${match.date.toLocaleDateString()} a été annulée. Motif : ${reason}`;

          // Home club
          await NotificationService.notify({
            organizationId,
            recipientClubId: homeClub._id.toString(),
            type,
            subject,
            body,
            dedupeKey: `${type}:${matchId}:${version}:${homeClub._id}`,
            entityType: 'Match',
            entityId: matchId,
          }, session);

          // Away club
          await NotificationService.notify({
            organizationId,
            recipientClubId: awayClub._id.toString(),
            type,
            subject,
            body,
            dedupeKey: `${type}:${matchId}:${version}:${awayClub._id}`,
            entityType: 'Match',
            entityId: matchId,
          }, session);
        }
      }

      await session.commitTransaction();
      return assignment;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

export default RefereeAssignmentService;
