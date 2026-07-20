import mongoose from 'mongoose';
import Match from '../models/Match';
import MatchEvent from '../models/MatchEvent';
import Joueur from '../models/Joueur';
import Competition from '../models/Competition';
import Suspension from '../models/Suspension';
import DisciplinaryAnomaly from '../models/DisciplinaryAnomaly';
// Register every model referenced by workspace population paths. Route bundles and
// isolated service tests do not otherwise guarantee that Mongoose has seen them.
import '../models/Arbitre';
import '../models/Club';
import '../models/Saison';
import '../models/Round';
import AuditService from './audit.service';
import connectDB from '../db';
import MatchOfficialAssignment from '../models/MatchOfficialAssignment';
import type { MatchEventCreateInput, MatchEventUpdateInput } from '../validators/match-event';

const eventPopulate = [
  { path: 'clubId', select: 'nom code logo' },
  { path: 'playerId', select: 'nom prenom numeroMaillot clubId photo' },
  { path: 'assistPlayerId', select: 'nom prenom numeroMaillot clubId' },
];

export class MatchWorkspaceService {
  static async getMatch(matchId: string, organizationId: string) {
    await connectDB();
    const match = await Match.findOne({ _id: matchId, organizationId })
      .populate('homeClubId', 'nom code logo')
      .populate('awayClubId', 'nom code logo')
      .populate('competitionId', 'nom code clubsParticipants')
      .populate('saisonId', 'nom code')
      .populate('roundId', 'number name status')
      .populate('arbitrePrincipalId', 'nom prenom categorie')
      .populate('assistants', 'nom prenom categorie')
      .lean();
    if (!match) throw new Error('MATCH_NOT_FOUND');

    const events = await MatchEvent.find({ organizationId, matchId })
      .populate(eventPopulate)
      .sort({ minute: 1, stoppageMinute: 1, createdAt: 1 })
      .lean();
    const active = events.filter((event) => event.status !== 'CANCELLED');
    const goalCount = active.filter((event) => ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(event.type)).length;
    const cardCount = active.filter((event) => ['YELLOW', 'SECOND_YELLOW_RED', 'DIRECT_RED'].includes(event.type)).length;

    // Fetch the latest published assignment for the Officials tab
    const latestAssignment = await MatchOfficialAssignment.findOne({
      matchId,
      organizationId,
      status: { $in: ['PUBLISHED', 'UPDATED'] },
    })
      .populate('referees.refereeId', 'displayName nom prenom categorie')
      .lean();

    let publishedOfficials = null;
    if (latestAssignment) {
      publishedOfficials = {
        publishedAt: latestAssignment.publishedAt,
        version: latestAssignment.version,
        status: latestAssignment.status,
        referees: latestAssignment.referees.map((r: any) => {
          const ref = r.refereeId as any;
          return {
            refereeId: ref?._id,
            displayName: ref ? (ref.displayName || `${ref.prenom} ${ref.nom}`) : 'N/A',
            role: r.role,
            categorie: ref?.categorie,
          };
        }),
      };
    }

    return {
      match,
      events,
      permissions: { canEdit: !match.homologue, canFinalize: !match.homologue, canReopen: match.homologue },
      counts: { goals: goalCount, cards: cardCount, cancelled: events.length - active.length },
      scoreFromEvents: this.deriveScore(match, active),
      publishedOfficials,
    };
  }

  static deriveScore(match: any, events: any[]) {
    let home = 0;
    let away = 0;
    const homeId = match.homeClubId?._id?.toString?.() ?? match.homeClubId.toString();
    for (const event of events) {
      if (!['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(event.type)) continue;
      const clubId = event.clubId?._id?.toString?.() ?? event.clubId.toString();
      const creditedHome = event.type === 'OWN_GOAL' ? clubId !== homeId : clubId === homeId;
      if (creditedHome) home += 1;
      else away += 1;
    }
    return { home, away };
  }

  static async updateMatch(matchId: string, organizationId: string, actorId: string, data: Record<string, unknown>) {
    await connectDB();
    const match = await Match.findOne({ _id: matchId, organizationId });
    if (!match) throw new Error('MATCH_NOT_FOUND');
    if (match.homologue) throw new Error('MATCH_OFFICIAL');
    if (data.expectedProcessingVersion !== undefined && data.expectedProcessingVersion !== match.processingVersion) {
      throw new Error('STALE_MATCH_VERSION');
    }
    const before = match.toObject();
    const allowed = ['scoreHome', 'scoreAway', 'statut', 'notes', 'date', 'stade', 'venueCity', 'arbitrePrincipalId', 'assistants', 'spectateurs'];
    for (const key of allowed) if (data[key] !== undefined) (match as any)[key] = data[key];
    if (data.scoreOverride === null) match.scoreOverride = undefined;
    else if (data.scoreOverride) {
      match.scoreOverride = {
        ...(data.scoreOverride as any),
        authorizedBy: new mongoose.Types.ObjectId(actorId),
        authorizedAt: new Date(),
      };
    }
    match.processingVersion += 1;
    await match.save();
    await AuditService.log({ actor: { id: actorId, role: 'FTF_ADMIN' }, action: 'MATCH_UPDATED', entityType: 'Match', entityId: matchId, before, after: match.toObject(), organizationId });
    return this.getMatch(matchId, organizationId);
  }

  static async createEvent(matchId: string, organizationId: string, actorId: string, input: MatchEventCreateInput) {
    const context = await this.validateEventContext(matchId, organizationId, input.clubId, input.playerId, input.assistPlayerId ?? undefined);
    const existing = await MatchEvent.findOne({ organizationId, matchId, clientMutationId: input.clientMutationId });
    if (existing) return existing.populate(eventPopulate);

    const activeSuspension = await Suspension.findOne({ organizationId, joueurId: input.playerId, status: { $in: ['ACTIVE', 'PROVISIONAL'] } }).lean();
    if (activeSuspension && (!input.confirmSuspendedPlayer || !input.anomalyNote)) throw new Error('SUSPENDED_PLAYER_CONFIRMATION_REQUIRED');

    const event = await MatchEvent.create({
      organizationId, matchId, competitionId: context.match.competitionId, saisonId: context.match.saisonId,
      roundId: context.match.roundId, clubId: input.clubId, playerId: input.playerId, type: input.type,
      minute: input.minute, stoppageMinute: input.stoppageMinute, assistPlayerId: input.assistPlayerId || undefined,
      cardReason: input.cardReason, reportReference: input.reportReference, notes: input.notes,
      clientMutationId: input.clientMutationId, createdBy: actorId, status: 'DRAFT',
    });
    if (activeSuspension) {
      await DisciplinaryAnomaly.findOneAndUpdate(
        { organizationId, sourceEventId: event._id, type: 'SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT' },
        { $setOnInsert: { organizationId, matchId, playerId: input.playerId, clubId: input.clubId, sourceEventId: event._id, type: 'SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT', status: 'CONFIRMED', evidence: input.anomalyNote, resolutionReason: input.anomalyNote, resolvedBy: actorId, resolvedAt: new Date() } },
        { upsert: true }
      );
    }
    await AuditService.log({ actor: { id: actorId, role: 'FTF_ADMIN' }, action: 'MATCH_EVENT_ADDED', entityType: 'MatchEvent', entityId: event._id, after: event.toObject(), organizationId });
    return event.populate(eventPopulate);
  }

  static async updateEvent(matchId: string, eventId: string, organizationId: string, actorId: string, input: MatchEventUpdateInput) {
    const event = await MatchEvent.findOne({ _id: eventId, matchId, organizationId });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    const match = await Match.findOne({ _id: matchId, organizationId });
    if (!match || match.homologue || event.status !== 'DRAFT') throw new Error('EVENT_LOCKED');
    const next = { clubId: input.clubId?.toString() ?? event.clubId.toString(), playerId: input.playerId?.toString() ?? event.playerId.toString(), assistPlayerId: input.assistPlayerId === null ? undefined : input.assistPlayerId?.toString() ?? event.assistPlayerId?.toString() };
    await this.validateEventContext(matchId, organizationId, next.clubId, next.playerId, next.assistPlayerId);
    const before = event.toObject();
    Object.assign(event, input);
    if (input.assistPlayerId === null) event.assistPlayerId = undefined;
    await event.save();
    await AuditService.log({ actor: { id: actorId, role: 'FTF_ADMIN' }, action: 'MATCH_EVENT_UPDATED', entityType: 'MatchEvent', entityId: event._id, before, after: event.toObject(), organizationId });
    return event.populate(eventPopulate);
  }

  static async cancelEvent(matchId: string, eventId: string, organizationId: string, actorId: string, reason: string) {
    const match = await Match.findOne({ _id: matchId, organizationId });
    const event = await MatchEvent.findOne({ _id: eventId, matchId, organizationId });
    if (!match || !event) throw new Error('EVENT_NOT_FOUND');
    if (match.homologue || event.status !== 'DRAFT') throw new Error('EVENT_LOCKED');
    event.status = 'CANCELLED'; event.cancelledAt = new Date(); event.cancelledBy = new mongoose.Types.ObjectId(actorId); event.cancellationReason = reason;
    await event.save();
    await AuditService.log({ actor: { id: actorId, role: 'FTF_ADMIN' }, action: 'MATCH_EVENT_CANCELLED', entityType: 'MatchEvent', entityId: event._id, before: { status: 'DRAFT' }, after: { status: 'CANCELLED', reason }, reason, organizationId });
    return event;
  }

  private static async validateEventContext(matchId: string, organizationId: string, clubId: string, playerId: string, assistPlayerId?: string) {
    const match = await Match.findOne({ _id: matchId, organizationId });
    if (!match) throw new Error('MATCH_NOT_FOUND');
    if (match.homologue) throw new Error('MATCH_OFFICIAL');
    const clubs = [match.homeClubId.toString(), match.awayClubId.toString()];
    if (!clubs.includes(clubId)) throw new Error('CLUB_NOT_IN_MATCH');
    const competition = await Competition.findOne({ _id: match.competitionId, organizationId }).lean();
    if (!competition?.clubsParticipants.some((id) => id.toString() === clubId)) throw new Error('CLUB_NOT_IN_COMPETITION');
    const player = await Joueur.findOne({ _id: playerId, organizationId, clubId }).lean();
    if (!player) throw new Error('PLAYER_NOT_IN_CLUB');
    if (assistPlayerId && !(await Joueur.exists({ _id: assistPlayerId, organizationId, clubId }))) throw new Error('ASSIST_NOT_IN_CLUB');
    return { match, player };
  }
}

export default MatchWorkspaceService;
