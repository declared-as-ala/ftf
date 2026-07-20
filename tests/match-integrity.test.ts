import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

vi.mock('../lib/db', () => ({ default: vi.fn(async () => undefined) }));

import MatchFinalizationService from '../lib/services/match-finalization.service';
import MatchCorrectionService, {
  MatchCorrectionRebuildRequiredError,
} from '../lib/services/match-correction.service';
import { DisciplineEngine } from '../lib/services/discipline-engine';
import { SuspensionService } from '../lib/services/suspension.service';
import { NotificationService } from '../lib/services/notification.service';
import StandingsService from '../lib/services/standings.service';
import Organization from '../lib/models/Organization';
import Saison from '../lib/models/Saison';
import Competition from '../lib/models/Competition';
import Club from '../lib/models/Club';
import Joueur from '../lib/models/Joueur';
import Match from '../lib/models/Match';
import DisciplinaryCard from '../lib/models/DisciplinaryCard';
import DisciplinaryRuleSet from '../lib/models/DisciplinaryRuleSet';
import Suspension from '../lib/models/Suspension';
import SuspensionServiceEntry from '../lib/models/SuspensionServiceEntry';
import Notification from '../lib/models/Notification';
import AuditLog from '../lib/models/AuditLog';
import MatchProjectionTask from '../lib/models/MatchProjectionTask';
import MatchEvent from '../lib/models/MatchEvent';
import MatchWorkspaceService from '../lib/services/match-workspace.service';
import Round from '../lib/models/Round';

let replSet: MongoMemoryReplSet;
let organizationId: mongoose.Types.ObjectId;
let otherOrganizationId: mongoose.Types.ObjectId;
let saisonId: mongoose.Types.ObjectId;
let competitionId: mongoose.Types.ObjectId;
let homeClubId: mongoose.Types.ObjectId;
let awayClubId: mongoose.Types.ObjectId;
let playerId: mongoose.Types.ObjectId;
const actorId = new mongoose.Types.ObjectId();

async function createFixtures() {
  organizationId = new mongoose.Types.ObjectId();
  otherOrganizationId = new mongoose.Types.ObjectId();
  saisonId = new mongoose.Types.ObjectId();
  competitionId = new mongoose.Types.ObjectId();
  homeClubId = new mongoose.Types.ObjectId();
  awayClubId = new mongoose.Types.ObjectId();
  playerId = new mongoose.Types.ObjectId();

  await Organization.create([
    { _id: organizationId, name: 'FTF', code: `FTF-${organizationId}`, type: 'FEDERATION' },
    { _id: otherOrganizationId, name: 'Other', code: `OTH-${otherOrganizationId}`, type: 'LEAGUE' },
  ]);
  await Saison.create({
    _id: saisonId,
    organizationId,
    nom: '2025-2026',
    code: `S-${saisonId}`,
    anneeDebut: 2025,
    anneeFin: 2026,
    dateDebut: new Date('2025-07-01'),
    dateFin: new Date('2026-06-30'),
    status: 'ACTIVE',
  });
  await Club.create([
    {
      _id: homeClubId,
      organizationId,
      nom: 'Home',
      code: `H-${homeClubId}`,
      slug: `home-${homeClubId}`,
      status: 'ACTIVE',
      ville: 'Tunis',
      stade: 'Home Stadium',
      emailOfficiel: `home-${homeClubId}@test.tn`,
      fondation: 1920,
    },
    {
      _id: awayClubId,
      organizationId,
      nom: 'Away',
      code: `A-${awayClubId}`,
      slug: `away-${awayClubId}`,
      status: 'ACTIVE',
      ville: 'Sfax',
      stade: 'Away Stadium',
      emailOfficiel: `away-${awayClubId}@test.tn`,
      fondation: 1930,
    },
  ]);
  await Competition.create({
    _id: competitionId,
    organizationId,
    saisonId,
    nom: 'Ligue 1',
    code: `L1-${competitionId}`,
    type: 'Championnat',
    niveau: 'National',
    dateDebut: new Date('2025-08-01'),
    dateFin: new Date('2026-05-31'),
    clubsParticipants: [homeClubId, awayClubId],
    status: 'ACTIVE',
    isOfficial: true,
  });
  await Joueur.create({
    _id: playerId,
    organizationId,
    clubId: homeClubId,
    nom: 'Test',
    prenom: 'Player',
    licenceNumber: `P-${playerId}`,
    licence: `P-${playerId}`,
    position: 'Milieu',
    status: 'ACTIVE',
    actif: true,
    dateNaissance: new Date('2000-01-01'),
    nationalite: 'Tunisienne',
  });
}

async function createDraftMatch(events: any[] = []) {
  return Match.create({
    organizationId,
    saisonId,
    competitionId,
    journee: 1,
    homeClubId,
    awayClubId,
    date: new Date('2026-02-01T15:00:00Z'),
    stade: 'Stade test',
    scoreHome: 0,
    scoreAway: 0,
    statut: 'Brouillon',
    isOfficial: true,
    homologue: false,
    processingVersion: 0,
    evenements: events,
  });
}

/** Like createDraftMatch, but linked to a Round — exercises the multi-task
 * projection enqueue path (STANDINGS_REBUILD + ROUND_COMPLETION together). */
async function createDraftMatchWithRound(events: any[] = []) {
  const round = await Round.create({
    organizationId,
    competitionId,
    saisonId,
    number: 1,
    name: 'Journée 1',
    dateDebut: new Date('2026-02-01T00:00:00Z'),
    dateFin: new Date('2026-02-02T00:00:00Z'),
    status: 'ACTIVE',
  });
  return Match.create({
    organizationId,
    saisonId,
    competitionId,
    roundId: round._id,
    journee: 1,
    homeClubId,
    awayClubId,
    date: new Date('2026-02-01T15:00:00Z'),
    stade: 'Stade test',
    scoreHome: 0,
    scoreAway: 0,
    statut: 'Brouillon',
    isOfficial: true,
    homologue: false,
    processingVersion: 0,
    evenements: events,
  });
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Promise.all([
    MatchEvent.init(),
    DisciplinaryCard.init(),
    SuspensionServiceEntry.init(),
    MatchProjectionTask.init(),
    Notification.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  vi.restoreAllMocks();
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
  await createFixtures();
});

describe('Match finalization integrity', () => {
  it('rolls back officialization when required discipline processing fails', async () => {
    const match = await createDraftMatch();
    vi.spyOn(DisciplineEngine, 'processMatchCards').mockRejectedValueOnce(
      new Error('injected discipline failure')
    );

    await expect(
      MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId)
    ).rejects.toThrow('injected discipline failure');

    const unchanged = await Match.findById(match._id).lean();
    expect(unchanged!.homologue).toBe(false);
    expect(unchanged!.processingVersion).toBe(0);
    expect(await AuditLog.countDocuments({ entityId: match._id })).toBe(0);
    expect(await MatchProjectionTask.countDocuments({ matchId: match._id })).toBe(0);
  });

  it('is idempotent across sequential calls and creates one disciplinary effect set', async () => {
    await DisciplinaryRuleSet.create({
      organizationId,
      seasonId: saisonId,
      competitionId,
      name: 'Competition threshold test',
      version: 1,
      yellowCardThreshold: 1,
      yellowCardSuspensionMatches: 1,
      effectiveFrom: new Date('2025-07-01'),
      active: true,
    });
    const match = await createDraftMatch([
      { type: 'Carton Jaune', minute: 20, joueurId: playerId, equipe: 'home' },
    ]);

    const first = await MatchFinalizationService.finalizeMatch(
      match._id,
      actorId.toString(),
      organizationId
    );
    const second = await MatchFinalizationService.finalizeMatch(
      match._id,
      actorId.toString(),
      organizationId
    );

    expect(first.status).toBe('finalized');
    expect(second.status).toBe('already_finalized');
    expect(await DisciplinaryCard.countDocuments({ matchId: match._id })).toBe(1);
    const suspension = await Suspension.findOne({ sourceMatchId: match._id }).lean();
    expect(suspension).toMatchObject({
      status: 'ACTIVE',
      matchesServed: 0,
      matchesRemaining: 1,
    });
    expect(await SuspensionServiceEntry.countDocuments({ suspensionId: suspension!._id })).toBe(0);
    expect(await Notification.countDocuments({ entityId: suspension!._id })).toBe(1);
    expect(await AuditLog.countDocuments({ entityId: match._id, action: 'MATCH_FINALIZED' })).toBe(1);
    expect(await MatchProjectionTask.countDocuments({ matchId: match._id })).toBe(1);
  });

  it('allows only one winner during concurrent finalization', async () => {
    const match = await createDraftMatch();
    const results = await Promise.all([
      MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId),
      MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'already_finalized',
      'finalized',
    ]);
    expect(await AuditLog.countDocuments({ entityId: match._id, action: 'MATCH_FINALIZED' })).toBe(1);
    expect((await Match.findById(match._id).lean())!.processingVersion).toBe(1);
  });

  it('persists failed rebuildable projections and retries them idempotently', async () => {
    const match = await createDraftMatch();
    const rebuild = vi
      .spyOn(StandingsService, 'rebuildCompetitionStandings')
      .mockRejectedValueOnce(new Error('injected projection failure'));

    const first = await MatchFinalizationService.finalizeMatch(
      match._id,
      actorId.toString(),
      organizationId
    );
    expect(first.status).toBe('finalized');
    expect((await MatchProjectionTask.findOne({ matchId: match._id }).lean())!.status).toBe('FAILED');

    rebuild.mockRestore();
    const retry = await MatchFinalizationService.finalizeMatch(
      match._id,
      actorId.toString(),
      organizationId
    );
    expect(retry.status).toBe('already_finalized');
    const task = await MatchProjectionTask.findOne({ matchId: match._id }).lean();
    expect(task!.status).toBe('COMPLETED');
    expect(task!.attempts).toBe(2);
  });

  it('does not expose or mutate a match through another organization', async () => {
    const match = await createDraftMatch();
    const result = await MatchFinalizationService.finalizeMatch(
      match._id,
      actorId.toString(),
      otherOrganizationId
    );
    expect(result).toMatchObject({ status: 'error', error: 'Match introuvable' });
    expect((await Match.findById(match._id).lean())!.homologue).toBe(false);
  });

  it('enqueues both durable projection tasks (standings + round completion) for a round-linked match', async () => {
    // Regression test: Model.create(array, { session }) throws in Mongoose 8
    // unless `ordered` is explicit when the array has more than one document.
    // Round-linked matches enqueue two tasks (STANDINGS_REBUILD + ROUND_COMPLETION)
    // in the same call, which only round-linked fixtures exercise.
    const match = await createDraftMatchWithRound();
    const result = await MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId);
    expect(result.status).toBe('finalized');
    const tasks = await MatchProjectionTask.find({ matchId: match._id }).lean();
    expect(tasks.map((t) => t.type).sort()).toEqual(['ROUND_COMPLETION', 'STANDINGS_REBUILD']);
    expect(tasks.every((t) => t.status === 'COMPLETED')).toBe(true);
  });
});

describe('Suspension ledger integrity', () => {
  it('rolls back ledger and decrement together when completion notification fails', async () => {
    const match = await createDraftMatch();
    await Match.updateOne(
      { _id: match._id },
      { $set: { homologue: true, statut: 'Terminé' } }
    );
    const suspension = await Suspension.create({
      organizationId,
      joueurId: playerId,
      clubId: homeClubId,
      sourceSeasonId: saisonId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'ALL_OFFICIAL_COMPETITIONS',
      matchesSuspended: 1,
      matchesServed: 0,
      matchesRemaining: 1,
      createdBy: 'SYSTEM',
    });
    vi.spyOn(NotificationService, 'notify').mockRejectedValueOnce(
      new Error('injected notification failure')
    );

    await expect(
      SuspensionService.processServingForMatch(match._id, organizationId)
    ).rejects.toThrow('injected notification failure');

    const unchanged = await Suspension.findById(suspension._id).lean();
    expect(unchanged!.matchesRemaining).toBe(1);
    expect(unchanged!.matchesServed).toBe(0);
    expect(await SuspensionServiceEntry.countDocuments({ suspensionId: suspension._id })).toBe(0);
  });

  it('never serves a suspension on the match that created it', async () => {
    const match = await createDraftMatch();
    await Match.updateOne(
      { _id: match._id },
      { $set: { homologue: true, statut: 'Terminé' } }
    );
    const suspension = await Suspension.create({
      organizationId,
      joueurId: playerId,
      clubId: homeClubId,
      sourceMatchId: match._id,
      sourceSeasonId: saisonId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'ALL_OFFICIAL_COMPETITIONS',
      matchesSuspended: 1,
      matchesServed: 0,
      matchesRemaining: 1,
      createdBy: 'SYSTEM',
    });

    await SuspensionService.processServingForMatch(match._id, organizationId);
    expect((await Suspension.findById(suspension._id).lean())!.matchesRemaining).toBe(1);
    expect(await SuspensionServiceEntry.countDocuments({ suspensionId: suspension._id })).toBe(0);
  });
});

describe('Match correction safety', () => {
  it('fails closed when discipline effects cannot yet be rebuilt safely', async () => {
    const match = await createDraftMatch();
    await Match.updateOne(
      { _id: match._id },
      { $set: { homologue: true, statut: 'Terminé' } }
    );
    await DisciplinaryCard.create({
      organizationId,
      matchId: match._id,
      competitionId,
      saisonId,
      joueurId: playerId,
      clubId: homeClubId,
      cardType: 'YELLOW',
      accumulationStatus: 'ACTIVE',
    });

    await expect(
      MatchCorrectionService.reopenMatch(
        match._id,
        'Correction du carton',
        actorId.toString(),
        organizationId
      )
    ).rejects.toBeInstanceOf(MatchCorrectionRebuildRequiredError);

    expect((await Match.findById(match._id).lean())!.homologue).toBe(true);
    expect(await AuditLog.countDocuments({ entityId: match._id, action: 'MATCH_REOPENED' })).toBe(0);
  });

  it('reopens a discipline-free match transactionally and queues standings repair', async () => {
    const match = await createDraftMatch();
    await Match.updateOne(
      { _id: match._id },
      { $set: { homologue: true, statut: 'Terminé', processingVersion: 1 } }
    );

    const reopened = await MatchCorrectionService.reopenMatch(
      match._id,
      'Correction du score',
      actorId.toString(),
      organizationId
    );

    expect(reopened!.homologue).toBe(false);
    expect(reopened!.statut).toBe('Brouillon');
    expect(reopened!.processingVersion).toBe(2);
    expect(await AuditLog.countDocuments({ entityId: match._id, action: 'MATCH_REOPENED' })).toBe(1);
    expect(await MatchProjectionTask.countDocuments({
      matchId: match._id,
      processingVersion: 2,
      status: 'COMPLETED',
    })).toBe(1);
  });
});

describe('Canonical match workspace events', () => {
  it('creates an idempotent event only for a player belonging to a participating club', async () => {
    const match = await createDraftMatch();
    const input = { clubId: homeClubId.toString(), playerId: playerId.toString(), type: 'GOAL' as const, minute: 12, clientMutationId: 'mutation-goal-0001', confirmSuspendedPlayer: false };
    const first = await MatchWorkspaceService.createEvent(match._id.toString(), organizationId.toString(), actorId.toString(), input);
    const retry = await MatchWorkspaceService.createEvent(match._id.toString(), organizationId.toString(), actorId.toString(), input);
    expect(first._id.toString()).toBe(retry._id.toString());
    expect(await MatchEvent.countDocuments({ matchId: match._id })).toBe(1);
  });

  it('rejects a player/club mismatch server-side', async () => {
    const match = await createDraftMatch();
    await expect(MatchWorkspaceService.createEvent(match._id.toString(), organizationId.toString(), actorId.toString(), { clubId: awayClubId.toString(), playerId: playerId.toString(), type: 'YELLOW', minute: 20, clientMutationId: 'mutation-card-0001', confirmSuspendedPlayer: false })).rejects.toThrow('PLAYER_NOT_IN_CLUB');
  });

  it('credits an own goal to the opponent', async () => {
    const match = await createDraftMatch();
    await MatchWorkspaceService.createEvent(match._id.toString(), organizationId.toString(), actorId.toString(), { clubId: homeClubId.toString(), playerId: playerId.toString(), type: 'OWN_GOAL', minute: 31, clientMutationId: 'mutation-own-goal', confirmSuspendedPlayer: false });
    const workspace = await MatchWorkspaceService.getMatch(match._id.toString(), organizationId.toString());
    expect(workspace.scoreFromEvents).toEqual({ home: 0, away: 1 });
  });

  it('blocks score mismatch and rolls back canonical event confirmation', async () => {
    const match = await createDraftMatch();
    await MatchWorkspaceService.createEvent(match._id.toString(), organizationId.toString(), actorId.toString(), { clubId: homeClubId.toString(), playerId: playerId.toString(), type: 'GOAL', minute: 41, clientMutationId: 'mutation-mismatch', confirmSuspendedPlayer: false });
    await expect(MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId)).rejects.toThrow('Le score saisi ne correspond pas');
    expect((await Match.findById(match._id).lean())!.homologue).toBe(false);
    expect((await MatchEvent.findOne({ matchId: match._id }).lean())!.status).toBe('DRAFT');
  });

  it('finalizes canonical cards with a stable source link and no duplicate', async () => {
    const match = await createDraftMatch();
    const event = await MatchWorkspaceService.createEvent(match._id.toString(), organizationId.toString(), actorId.toString(), { clubId: homeClubId.toString(), playerId: playerId.toString(), type: 'YELLOW', minute: 51, clientMutationId: 'mutation-canonical-card', confirmSuspendedPlayer: false });
    await MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId);
    await MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId);
    expect((await MatchEvent.findById(event._id).lean())!.status).toBe('CONFIRMED');
    expect(await DisciplinaryCard.countDocuments({ sourceEventId: event._id })).toBe(1);
  });

  it('reopens canonical discipline effects without deleting their history', async () => {
    const match = await createDraftMatch();
    const event = await MatchWorkspaceService.createEvent(match._id.toString(), organizationId.toString(), actorId.toString(), { clubId: homeClubId.toString(), playerId: playerId.toString(), type: 'YELLOW', minute: 61, clientMutationId: 'mutation-reopen-card', confirmSuspendedPlayer: false });
    await MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId);
    await MatchCorrectionService.reopenMatch(match._id, 'Correction du carton canonique', actorId.toString(), organizationId);
    expect((await MatchEvent.findById(event._id).lean())!.status).toBe('DRAFT');
    // sourceEventId is unset on cancellation (freeing it for a future re-finalize
    // of the same event); the historical link is preserved as previousSourceEventId.
    const cancelledCard = await DisciplinaryCard.findOne({ previousSourceEventId: event._id }).lean();
    expect(cancelledCard!.accumulationStatus).toBe('CANCELLED');
    expect(cancelledCard!.sourceEventId).toBeUndefined();
    expect((await Match.findById(match._id).lean())!.homologue).toBe(false);
  });

  it('re-finalizes the same canonical event after a reopen without a sourceEventId collision', async () => {
    // Regression test: a reopen used to leave sourceEventId set on the
    // cancelled card, so re-finalizing the same event hit E11000 on the
    // unique sourceEventId index instead of creating a fresh card.
    const match = await createDraftMatch();
    const event = await MatchWorkspaceService.createEvent(match._id.toString(), organizationId.toString(), actorId.toString(), { clubId: homeClubId.toString(), playerId: playerId.toString(), type: 'YELLOW', minute: 61, clientMutationId: 'mutation-refinalize-card', confirmSuspendedPlayer: false });
    await MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId);
    await MatchCorrectionService.reopenMatch(match._id, 'Correction avant re-homologation', actorId.toString(), organizationId);

    const result = await MatchFinalizationService.finalizeMatch(match._id, actorId.toString(), organizationId);
    expect(result.status).toBe('finalized');
    expect((await Match.findById(match._id).lean())!.homologue).toBe(true);

    const cards = await DisciplinaryCard.find({ matchId: match._id }).lean();
    expect(cards).toHaveLength(2);
    expect(cards.filter((c) => c.accumulationStatus === 'CANCELLED')).toHaveLength(1);
    const fresh = cards.find((c) => c.accumulationStatus !== 'CANCELLED')!;
    expect(fresh.sourceEventId?.toString()).toBe(event._id.toString());
  });
});
