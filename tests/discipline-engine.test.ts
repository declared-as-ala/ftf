import { vi } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => {
      const serialized = body !== undefined ? JSON.parse(JSON.stringify(body)) : body;
      return {
        status: init?.status ?? 200,
        headers: new Headers(),
        json: async () => serialized,
        text: async () => typeof body === 'string' ? body : JSON.stringify(body),
      } as any;
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

const mockSession = {
  user: {
    id: '6540deadbeef1234567890aa',
    role: 'FTF_ADMIN',
    organizationId: '6540deadbeef1234567890bb',
  },
};

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    requireAdmin: vi.fn().mockImplementation(async () => mockSession),
  };
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import { YellowCardAccumulationService } from '../lib/services/yellow-card-accumulation.service';
import { SuspensionService } from '../lib/services/suspension.service';
import { RedCardDecisionService } from '../lib/services/red-card-decision.service';
import { EligibilityService } from '../lib/services/eligibility.service';
import DisciplinaryCard from '../lib/models/DisciplinaryCard';
import Suspension from '../lib/models/Suspension';
import SuspensionServiceEntry from '../lib/models/SuspensionServiceEntry';
import Joueur from '../lib/models/Joueur';
import Club from '../lib/models/Club';
import Match from '../lib/models/Match';
import Competition from '../lib/models/Competition';
import Saison from '../lib/models/Saison';
import Organization from '../lib/models/Organization';
import Notification from '../lib/models/Notification';

let replSet: MongoMemoryReplSet;
const orgId = new mongoose.Types.ObjectId();
const saisonId = new mongoose.Types.ObjectId();
const competitionId = new mongoose.Types.ObjectId();
const clubId = new mongoose.Types.ObjectId();
const playerId = new mongoose.Types.ObjectId();

async function createBasicFixtures() {
  await Organization.create({ _id: orgId, name: 'FTF', code: 'FTF', type: 'FEDERATION', active: true });
  await Saison.create({ _id: saisonId, organizationId: orgId, nom: '2025-2026', code: '2025-2026', anneeDebut: 2025, anneeFin: 2026, dateDebut: new Date('2025-07-01'), dateFin: new Date('2026-06-30'), status: 'ACTIVE', isCurrent: true });
  await Competition.create({ _id: competitionId, organizationId: orgId, saisonId, seasonId: saisonId, nom: 'Ligue 1', code: 'L1', format: 'LEAGUE', category: 'Professionnel', isOfficial: true, status: 'ACTIVE', pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0, tieBreakers: ['POINTS', 'GOAL_DIFFERENCE'], clubIds: [clubId], dateDebut: new Date('2025-08-01'), dateFin: new Date('2026-05-31'), type: 'Championnat', niveau: 'National' });
  await Club.create({ _id: clubId, organizationId: orgId, nom: 'EST', code: 'EST', slug: 'est', shortName: 'EST', status: 'ACTIVE', ville: 'Tunis', stade: 'Stade Olympique', emailOfficiel: 'contact@est.tn', fondation: 1919 });
  await Joueur.create({ _id: playerId, organizationId: orgId, clubId, nom: 'Test', prenom: 'Joueur', licenceNumber: 'TST-001', position: 'Milieu', status: 'ACTIVE', actif: true, licence: 'TST-001', dateNaissance: new Date('2000-01-01'), nationalite: 'Tunisienne' });
}

async function createMatch(overrides: any = {}) {
  return Match.create({
    organizationId: orgId,
    saisonId,
    competitionId,
    journee: 1,
    homeClubId: clubId,
    awayClubId: new mongoose.Types.ObjectId(),
    date: new Date(),
    stade: 'Test',
    scoreHome: 0,
    scoreAway: 0,
    statut: 'Terminé',
    isOfficial: true,
    homologue: true,
    processingVersion: 0,
    ...overrides,
  });
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('YellowCardAccumulationService', () => {
  it('1st yellow → status ACTIVE, count 1', async () => {
    await createBasicFixtures();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const { card } = await YellowCardAccumulationService.processYellow({
        matchId: new mongoose.Types.ObjectId().toString(),
        joueurId: playerId.toString(),
        clubId: clubId.toString(),
        competitionId: competitionId.toString(),
        saisonId: saisonId.toString(),
        organizationId: orgId.toString(),
        ruleSetThreshold: 3,
        ruleSetSuspensionMatches: 1,
        ruleSetScope: 'ALL_OFFICIAL_COMPETITIONS',
        matchIsOfficial: true,
      }, session);
      await session.commitTransaction();
      expect(card.accumulationStatus).toBe('ACTIVE');
      expect(card.accumulationCount).toBe(1);
    } finally {
      session.endSession();
    }
  });

  it('3 yellows → auto-suspension created, cards consumed', async () => {
    await createBasicFixtures();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const matchId = new mongoose.Types.ObjectId();
      // Create 3 yellows
      for (let i = 0; i < 3; i++) {
        await YellowCardAccumulationService.processYellow({
          matchId: matchId.toString(),
          joueurId: playerId.toString(),
          clubId: clubId.toString(),
          competitionId: competitionId.toString(),
          saisonId: saisonId.toString(),
          organizationId: orgId.toString(),
          ruleSetThreshold: 3,
          ruleSetSuspensionMatches: 1,
          ruleSetScope: 'ALL_OFFICIAL_COMPETITIONS',
          matchIsOfficial: true,
        }, session);
      }
      await session.commitTransaction();

      const cards = await DisciplinaryCard.find({ joueurId: playerId }).sort({ createdAt: 1 });
      // First 2 yellows remain ACTIVE, the rest are consumed
      const activeCards = cards.filter(c => c.accumulationStatus === 'ACTIVE');
      const consumedCards = cards.filter(c => c.accumulationStatus === 'CONSUMED_BY_SUSPENSION');
      expect(activeCards.length).toBe(0);
      expect(consumedCards.length).toBe(3);

      const suspensions = await Suspension.find({ joueurId: playerId });
      expect(suspensions.length).toBe(1);
      expect(suspensions[0].suspensionType).toBe('YELLOW_ACCUMULATION');
      expect(suspensions[0].matchesSuspended).toBe(1);
    } finally {
      session.endSession();
    }
  });

  it('friendly match yellow → NOT_OFFICIAL, not counted', async () => {
    await createBasicFixtures();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const { card } = await YellowCardAccumulationService.processYellow({
        matchId: new mongoose.Types.ObjectId().toString(),
        joueurId: playerId.toString(),
        clubId: clubId.toString(),
        competitionId: competitionId.toString(),
        saisonId: saisonId.toString(),
        organizationId: orgId.toString(),
        ruleSetThreshold: 3,
        ruleSetSuspensionMatches: 1,
        ruleSetScope: 'ALL_OFFICIAL_COMPETITIONS',
        matchIsOfficial: false,
      }, session);
      await session.commitTransaction();
      expect(card.accumulationStatus).toBe('NOT_OFFICIAL');
      expect(card.accumulationCount).toBe(0);
    } finally {
      session.endSession();
    }
  });

  it('4th yellow at threshold 3 → second cycle', async () => {
    await createBasicFixtures();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const matchId = new mongoose.Types.ObjectId();
      // 3 yellows → first suspension (all consumed)
      for (let i = 0; i < 3; i++) {
        await YellowCardAccumulationService.processYellow({
          matchId: matchId.toString(),
          joueurId: playerId.toString(),
          clubId: clubId.toString(),
          competitionId: competitionId.toString(),
          saisonId: saisonId.toString(),
          organizationId: orgId.toString(),
          ruleSetThreshold: 3,
          ruleSetSuspensionMatches: 1,
          ruleSetScope: 'ALL_OFFICIAL_COMPETITIONS',
          matchIsOfficial: true,
        }, session);
      }
      // 4th yellow → new cycle starts at count 1 (previous ACTIVE cards were consumed)
      const { card } = await YellowCardAccumulationService.processYellow({
        matchId: matchId.toString(),
        joueurId: playerId.toString(),
        clubId: clubId.toString(),
        competitionId: competitionId.toString(),
        saisonId: saisonId.toString(),
        organizationId: orgId.toString(),
        ruleSetThreshold: 3,
        ruleSetSuspensionMatches: 1,
        ruleSetScope: 'ALL_OFFICIAL_COMPETITIONS',
        matchIsOfficial: true,
      }, session);
      await session.commitTransaction();
      expect(card.accumulationCount).toBe(1); // Resets after consumption
      // No second suspension yet (needs 3 more)
      const suspensions = await Suspension.find({ joueurId: playerId });
      expect(suspensions.length).toBe(1);
    } finally {
      session.endSession();
    }
  });

  it('season-end clearance', async () => {
    await createBasicFixtures();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await YellowCardAccumulationService.processYellow({
        matchId: new mongoose.Types.ObjectId().toString(),
        joueurId: playerId.toString(),
        clubId: clubId.toString(),
        competitionId: competitionId.toString(),
        saisonId: saisonId.toString(),
        organizationId: orgId.toString(),
        ruleSetThreshold: 3,
        ruleSetSuspensionMatches: 1,
        ruleSetScope: 'ALL_OFFICIAL_COMPETITIONS',
        matchIsOfficial: true,
      }, session);
      await session.commitTransaction();
    } finally {
      session.endSession();
    }

    const cleared = await YellowCardAccumulationService.clearSeasonYellows(saisonId, new mongoose.Types.ObjectId().toString(), orgId);
    expect(cleared).toBe(1);

    const remaining = await DisciplinaryCard.countDocuments({ joueurId: playerId, accumulationStatus: 'ACTIVE' });
    expect(remaining).toBe(0);
    const clearedCount = await DisciplinaryCard.countDocuments({ joueurId: playerId, accumulationStatus: 'CLEARED_AT_SEASON_END' });
    expect(clearedCount).toBe(1);
  });
});

describe('RedCardDecisionService', () => {
  it('provisional → decision recorded with deduction', async () => {
    await createBasicFixtures();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const { suspension: prov } = await YellowCardAccumulationService.processRedCard({
        matchId: new mongoose.Types.ObjectId().toString(),
        joueurId: playerId.toString(),
        clubId: clubId.toString(),
        competitionId: competitionId.toString(),
        saisonId: saisonId.toString(),
        organizationId: orgId.toString(),
        cardType: 'DIRECT_RED',
        matchIsOfficial: true,
      }, session);
      await session.commitTransaction();

      expect(prov.status).toBe('PROVISIONAL');
      expect(prov.suspensionType).toBe('RED_CARD_PROVISIONAL');

      // Record decision
      const decided = await RedCardDecisionService.recordDecision(
        prov._id.toString(),
        {
          totalMatches: 3,
          scope: 'ALL_COMPETITIONS',
          decisionDate: new Date(),
          decisionReference: 'D-2025-001',
          decisionReason: 'Conduite violente',
          matchesMissedPreDecision: 1,
          actorId: 'test-user',
          organizationId: orgId.toString(),
        }
      );

      expect(decided.status).toBe('ACTIVE');
      expect(decided.suspensionType).toBe('RED_CARD_FINAL');
      expect(decided.matchesSuspended).toBe(3);
      expect(decided.matchesServed).toBe(1); // 1 already missed
      expect(decided.matchesRemaining).toBe(2); // 3 - 1
    } finally {
      session.endSession();
    }
  });

  it('decision with all matches already missed → SERVED immediately', async () => {
    await createBasicFixtures();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const { suspension: prov } = await YellowCardAccumulationService.processRedCard({
        matchId: new mongoose.Types.ObjectId().toString(),
        joueurId: playerId.toString(),
        clubId: clubId.toString(),
        competitionId: competitionId.toString(),
        saisonId: saisonId.toString(),
        organizationId: orgId.toString(),
        cardType: 'DIRECT_RED',
        matchIsOfficial: true,
      }, session);
      await session.commitTransaction();

      const decided = await RedCardDecisionService.recordDecision(
        prov._id.toString(),
        {
          totalMatches: 2,
          scope: 'ALL_COMPETITIONS',
          decisionDate: new Date(),
          decisionReference: 'D-2025-002',
          decisionReason: 'Test',
          matchesMissedPreDecision: 2,
          actorId: 'test-user',
          organizationId: orgId.toString(),
        }
      );

      expect(decided.status).toBe('SERVED');
      expect(decided.matchesRemaining).toBe(0);
    } finally {
      session.endSession();
    }
  });

  it('cancel suspension with reason', async () => {
    await createBasicFixtures();
    const suspension = await Suspension.create({
      organizationId: orgId,
      joueurId: playerId,
      clubId,
      sourceSeasonId: saisonId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'ALL_OFFICIAL_COMPETITIONS',
      matchesSuspended: 1,
      matchesServed: 0,
      matchesRemaining: 1,
      createdBy: 'system',
    });

    const cancelled = await RedCardDecisionService.cancelSuspension(
      suspension._id.toString(),
      'Erreur administrative : le joueur avait déjà purgé',
      new mongoose.Types.ObjectId().toString(),
      orgId.toString()
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledReason).toBe('Erreur administrative : le joueur avait déjà purgé');
  });

  it('cancel without reason → throws', async () => {
    await createBasicFixtures();
    const suspension = await Suspension.create({
      organizationId: orgId,
      joueurId: playerId,
      clubId,
      sourceSeasonId: saisonId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'ALL_OFFICIAL_COMPETITIONS',
      matchesSuspended: 1,
      matchesServed: 0,
      matchesRemaining: 1,
      createdBy: 'system',
    });

    await expect(
      RedCardDecisionService.cancelSuspension(suspension._id.toString(), 'Non', 'test-user', orgId.toString())
    ).rejects.toThrow('Une raison (min 5 caractères) est obligatoire');
  });
});

describe('SuspensionService', () => {
  it('serving on finalized match → ledger entry + decrement', async () => {
    await createBasicFixtures();
    const match = await createMatch({ homologue: true, scoreHome: 1, scoreAway: 0 });

    const suspension = await Suspension.create({
      organizationId: orgId,
      joueurId: playerId,
      clubId,
      sourceSeasonId: saisonId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'ALL_OFFICIAL_COMPETITIONS',
      matchesSuspended: 2,
      matchesServed: 0,
      matchesRemaining: 2,
      createdBy: 'system',
    });

    await SuspensionService.processServingForMatch(match._id.toString(), orgId.toString());

    const updated = await Suspension.findById(suspension._id);
    expect(updated!.matchesServed).toBe(1);
    expect(updated!.matchesRemaining).toBe(1);
    expect(updated!.status).toBe('ACTIVE');

    const entries = await SuspensionServiceEntry.find({ suspensionId: suspension._id });
    expect(entries.length).toBe(1);
    expect(entries[0].counted).toBe(true);
    expect(entries[0].reason).toBe('OFFICIAL_MATCH_PLAYED');
  });

  it('same match processed twice → no double decrement', async () => {
    await createBasicFixtures();
    const match = await createMatch({ homologue: true, scoreHome: 1, scoreAway: 0 });

    const suspension = await Suspension.create({
      organizationId: orgId,
      joueurId: playerId,
      clubId,
      sourceSeasonId: saisonId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'ALL_OFFICIAL_COMPETITIONS',
      matchesSuspended: 2,
      matchesServed: 0,
      matchesRemaining: 2,
      createdBy: 'system',
    });

    await SuspensionService.processServingForMatch(match._id.toString(), orgId.toString());
    await SuspensionService.processServingForMatch(match._id.toString(), orgId.toString());

    const updated = await Suspension.findById(suspension._id);
    expect(updated!.matchesServed).toBe(1);
    expect(updated!.matchesRemaining).toBe(1);

    const entries = await SuspensionServiceEntry.find({ suspensionId: suspension._id });
    expect(entries.length).toBe(1); // Still only 1
  });

  it('serving completes the suspension when remaining hits 0', async () => {
    await createBasicFixtures();
    const match1 = await createMatch({ homologue: true, scoreHome: 1, scoreAway: 0 });
    const match2 = await createMatch({ homologue: true, scoreHome: 2, scoreAway: 1, journee: 2 });

    const suspension = await Suspension.create({
      organizationId: orgId,
      joueurId: playerId,
      clubId,
      sourceSeasonId: saisonId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'ALL_OFFICIAL_COMPETITIONS',
      matchesSuspended: 1,
      matchesServed: 0,
      matchesRemaining: 1,
      createdBy: 'system',
    });

    await SuspensionService.processServingForMatch(match1._id.toString(), orgId.toString());

    const updated = await Suspension.findById(suspension._id);
    expect(updated!.status).toBe('SERVED');
    expect(updated!.matchesRemaining).toBe(0);
  });

  it('wrong competition scope → not counted', async () => {
    await createBasicFixtures();
    const otherComp = await Competition.create({
      organizationId: orgId,
      saisonId,
      seasonId: saisonId,
      nom: 'Coupe',
      code: 'CP',
      format: 'CUP',
      category: 'Professionnel',
      isOfficial: true,
      status: 'ACTIVE',
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0,
      tieBreakers: ['POINTS'],
      clubIds: [clubId],
      dateDebut: new Date('2025-08-01'),
      dateFin: new Date('2026-05-31'),
      type: 'Coupe',
      niveau: 'National',
    });
    const match = await createMatch({ homologue: true, scoreHome: 1, scoreAway: 0, competitionId: otherComp._id });

    const suspension = await Suspension.create({
      organizationId: orgId,
      joueurId: playerId,
      clubId,
      sourceSeasonId: saisonId,
      competitionId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'SAME_COMPETITION',
      matchesSuspended: 2,
      matchesServed: 0,
      matchesRemaining: 2,
      createdBy: 'system',
    });

    await SuspensionService.processServingForMatch(match._id.toString(), orgId.toString());

    const updated = await Suspension.findById(suspension._id);
    expect(updated!.matchesServed).toBe(0);
    expect(updated!.matchesRemaining).toBe(2);

    const entries = await SuspensionServiceEntry.find({ suspensionId: suspension._id });
    expect(entries[0].reason).toBe('WRONG_COMPETITION');
    expect(entries[0].counted).toBe(false);
  });
});

describe('EligibilityService', () => {
  it('active suspension → unavailable', async () => {
    await createBasicFixtures();
    await Suspension.create({
      organizationId: orgId,
      joueurId: playerId,
      clubId,
      sourceSeasonId: saisonId,
      suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE',
      scope: 'ALL_OFFICIAL_COMPETITIONS',
      matchesSuspended: 1,
      matchesServed: 0,
      matchesRemaining: 1,
      createdBy: 'system',
    });

    const eligibility = await EligibilityService.getMatchEligibility(
      new mongoose.Types.ObjectId().toString(),
      clubId.toString(),
      new mongoose.Types.ObjectId().toString(),
      saisonId.toString(),
      3,
      orgId.toString()
    );

    const homePlayer = eligibility.home.find(p => p.player._id === playerId.toString());
    expect(homePlayer).toBeDefined();
    expect(homePlayer!.available).toBe(false);
    expect(homePlayer!.activeYellows).toBe(0);
  });

  it('2 active yellows (threshold 3) → at risk', async () => {
    await createBasicFixtures();
    // Create 2 yellows
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      for (let i = 0; i < 2; i++) {
        await YellowCardAccumulationService.processYellow({
          matchId: new mongoose.Types.ObjectId().toString(),
          joueurId: playerId.toString(),
          clubId: clubId.toString(),
          competitionId: competitionId.toString(),
          saisonId: saisonId.toString(),
          organizationId: orgId.toString(),
          ruleSetThreshold: 3,
          ruleSetSuspensionMatches: 1,
          ruleSetScope: 'ALL_OFFICIAL_COMPETITIONS',
          matchIsOfficial: true,
        }, session);
      }
      await session.commitTransaction();
    } finally {
      session.endSession();
    }

    const eligibility = await EligibilityService.getMatchEligibility(
      new mongoose.Types.ObjectId().toString(),
      clubId.toString(),
      new mongoose.Types.ObjectId().toString(),
      saisonId.toString(),
      3,
      orgId.toString()
    );

    const homePlayer = eligibility.home.find(p => p.player._id === playerId.toString());
    expect(homePlayer).toBeDefined();
    expect(homePlayer!.available).toBe(true);
    expect(homePlayer!.atRisk).toBe(true);
    expect(homePlayer!.activeYellows).toBe(2);
  });
});
