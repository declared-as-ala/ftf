import { vi } from 'vitest';

// 1. Mock next/server and @/lib/auth before any other imports
vi.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: Headers;
    body: any;
    constructor(body: any, init?: any) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }
    static json(body: any, init?: any) {
      const serialized = body !== undefined ? JSON.parse(JSON.stringify(body)) : body;
      return {
        status: init?.status ?? 200,
        headers: new Headers(init?.headers),
        json: async () => serialized,
        text: async () => typeof body === 'string' ? body : JSON.stringify(body),
      } as any;
    }
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

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

// Imports of modules under test
import * as officialsRoute from '../app/api/admin/matches/[id]/officials/route';
import * as publishRoute from '../app/api/admin/matches/[id]/officials/publish/route';
import * as cancelRoute from '../app/api/admin/matches/[id]/officials/cancel/route';

import MatchOfficialAssignment from '../lib/models/MatchOfficialAssignment';
import Match from '../lib/models/Match';
import Arbitre from '../lib/models/Arbitre';
import Club from '../lib/models/Club';
import Organization from '../lib/models/Organization';
import AuditLog from '../lib/models/AuditLog';
import Notification from '../lib/models/Notification';
import RefereeAssignmentService from '../lib/services/referee-assignment.service';

let replSet: MongoMemoryReplSet;

function createTestClub(nom: string, code: string, orgId: mongoose.Types.ObjectId) {
  return Club.create({
    nom,
    code,
    slug: nom.toLowerCase(),
    shortName: nom,
    status: 'ACTIVE',
    organizationId: orgId,
    emailOfficiel: `${nom.toLowerCase()}@test.tn`,
    fondation: 1920,
    ville: 'Tunis',
    stade: 'Stade de Test',
  });
}

describe('Referee Assignments & Conflict Engine (Sprint 9.2)', () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replSet.getUri('assignments-api-test');
    const { default: connectDB } = await import('../lib/db');
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await replSet.stop();
  });

  beforeEach(async () => {
    await MatchOfficialAssignment.deleteMany({});
    await Match.deleteMany({});
    await Arbitre.deleteMany({});
    await Club.deleteMany({});
    await Organization.deleteMany({});
    await AuditLog.deleteMany({});
    await Notification.deleteMany({});
    vi.clearAllMocks();
  });

  it('Saves draft, overwrites existing draft, and increments version when published exists', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    // Create clubs & match
    const homeClub = await createTestClub('EST', 'EST', orgId);
    const awayClub = await createTestClub('CA', 'CA', orgId);
    const match = await Match.create({
      organizationId: orgId,
      saisonId: new mongoose.Types.ObjectId(),
      competitionId: new mongoose.Types.ObjectId(),
      journee: 1,
      homeClubId: homeClub._id,
      awayClubId: awayClub._id,
      date: new Date(),
      stade: 'Rades',
      scoreHome: 0,
      scoreAway: 0,
      statut: 'Programmé',
      isOfficial: false,
      homologue: false,
      processingVersion: 1,
    });

    const referee = await Arbitre.create({
      nom: 'Srairi',
      prenom: 'Youssef',
      categorie: 'ELITE',
      dateNaissance: new Date('1980-01-01'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      organizationId: orgId,
      status: 'ACTIVE',
      actif: true,
    });

    // 1. Save new draft
    const draft1 = await RefereeAssignmentService.saveDraft({
      matchId: match._id.toString(),
      referees: [{ refereeId: referee._id.toString(), role: 'MAIN' }],
      notes: 'Premier test draft',
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    expect(draft1.version).toBe(1);
    expect(draft1.status).toBe('DRAFT');
    expect(draft1.notes).toBe('Premier test draft');

    // 2. Overwrite draft 1
    const draft1Updated = await RefereeAssignmentService.saveDraft({
      matchId: match._id.toString(),
      referees: [{ refereeId: referee._id.toString(), role: 'MAIN' }],
      notes: 'Draft écrasé',
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    expect(draft1Updated.version).toBe(1);
    expect(draft1Updated.notes).toBe('Draft écrasé');

    // 3. Publish draft 1
    await RefereeAssignmentService.publish({
      matchId: match._id.toString(),
      version: 1,
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    // 4. Save new draft (should increment version to 2)
    const draft2 = await RefereeAssignmentService.saveDraft({
      matchId: match._id.toString(),
      referees: [{ refereeId: referee._id.toString(), role: 'MAIN' }],
      notes: 'Nouveau draft v2',
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    expect(draft2.version).toBe(2);
    expect(draft2.status).toBe('DRAFT');
  });

  it('Publish rejects duplicate roles and unavailable referees', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    // Create clubs & match
    const homeClub = await createTestClub('EST', 'EST', orgId);
    const awayClub = await createTestClub('CA', 'CA', orgId);
    const match = await Match.create({
      organizationId: orgId,
      saisonId: new mongoose.Types.ObjectId(),
      competitionId: new mongoose.Types.ObjectId(),
      journee: 1,
      homeClubId: homeClub._id,
      awayClubId: awayClub._id,
      date: new Date(),
      stade: 'Rades',
      scoreHome: 0,
      scoreAway: 0,
      statut: 'Programmé',
      isOfficial: false,
      homologue: false,
      processingVersion: 1,
    });

    const referee = await Arbitre.create({
      nom: 'Srairi',
      prenom: 'Youssef',
      categorie: 'ELITE',
      dateNaissance: new Date('1980-01-01'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      organizationId: orgId,
      status: 'SUSPENDED', // Non-active
      actif: false,
    });

    // Save draft with non-active referee
    await RefereeAssignmentService.saveDraft({
      matchId: match._id.toString(),
      referees: [{ refereeId: referee._id.toString(), role: 'MAIN' }],
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    // Attempt publication
    await expect(
      RefereeAssignmentService.publish({
        matchId: match._id.toString(),
        version: 1,
        actorId: mockSession.user.id,
        organizationId: orgId.toString(),
      })
    ).rejects.toThrow('statut');
  });

  it('Detects overlapping match time (3h) and near-time turnaround conflicts (24h)', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    // Create clubs
    const club1 = await createTestClub('EST', 'EST', orgId);
    const club2 = await createTestClub('CA', 'CA', orgId);
    const club3 = await createTestClub('ESS', 'ESS', orgId);
    const club4 = await createTestClub('CSS', 'CSS', orgId);

    // Match A: Played on 2026-07-20 at 14:00
    const matchA = await Match.create({
      organizationId: orgId,
      saisonId: new mongoose.Types.ObjectId(),
      competitionId: new mongoose.Types.ObjectId(),
      journee: 1,
      homeClubId: club1._id,
      awayClubId: club2._id,
      date: new Date('2026-07-20T14:00:00Z'),
      stade: 'Rades',
      scoreHome: 0,
      scoreAway: 0,
      statut: 'Programmé',
      isOfficial: false,
      homologue: false,
      processingVersion: 1,
    });

    // Match B: Played on 2026-07-20 at 16:00 (overlapping: 2h difference)
    const matchB = await Match.create({
      organizationId: orgId,
      saisonId: new mongoose.Types.ObjectId(),
      competitionId: new mongoose.Types.ObjectId(),
      journee: 1,
      homeClubId: club3._id,
      awayClubId: club4._id,
      date: new Date('2026-07-20T16:00:00Z'),
      stade: 'Sousse',
      scoreHome: 0,
      scoreAway: 0,
      statut: 'Programmé',
      isOfficial: false,
      homologue: false,
      processingVersion: 1,
    });

    // Match C: Played on 2026-07-21 at 10:00 (near-time: 20h difference)
    const matchC = await Match.create({
      organizationId: orgId,
      saisonId: new mongoose.Types.ObjectId(),
      competitionId: new mongoose.Types.ObjectId(),
      journee: 1,
      homeClubId: club1._id,
      awayClubId: club3._id,
      date: new Date('2026-07-21T10:00:00Z'),
      stade: 'Sfax',
      scoreHome: 0,
      scoreAway: 0,
      statut: 'Programmé',
      isOfficial: false,
      homologue: false,
      processingVersion: 1,
    });

    const referee = await Arbitre.create({
      nom: 'Guirat',
      prenom: 'Haythem',
      categorie: 'ELITE',
      dateNaissance: new Date('1990-01-01'),
      nationalite: 'Tunisienne',
      ville: 'Sousse',
      organizationId: orgId,
      status: 'ACTIVE',
      actif: true,
    });

    // Publish Match A assignment first
    await RefereeAssignmentService.saveDraft({
      matchId: matchA._id.toString(),
      referees: [{ refereeId: referee._id.toString(), role: 'MAIN' }],
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });
    await RefereeAssignmentService.publish({
      matchId: matchA._id.toString(),
      version: 1,
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    // Attempt to publish Match B (Overlapping time conflict)
    await RefereeAssignmentService.saveDraft({
      matchId: matchB._id.toString(),
      referees: [{ refereeId: referee._id.toString(), role: 'MAIN' }],
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });
    await expect(
      RefereeAssignmentService.publish({
        matchId: matchB._id.toString(),
        version: 1,
        actorId: mockSession.user.id,
        organizationId: orgId.toString(),
      })
    ).rejects.toThrow('Conflit horaire');

    // Attempt to publish Match C (turnaround turnaround conflict < 24h)
    await RefereeAssignmentService.saveDraft({
      matchId: matchC._id.toString(),
      referees: [{ refereeId: referee._id.toString(), role: 'MAIN' }],
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });
    await expect(
      RefereeAssignmentService.publish({
        matchId: matchC._id.toString(),
        version: 1,
        actorId: mockSession.user.id,
        organizationId: orgId.toString(),
      })
    ).rejects.toThrow('turnaround');
  });

  it('Updating a published assignment requires reason, cancels previous, and dispatches notifications', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    // Create clubs & match
    const homeClub = await createTestClub('EST', 'EST', orgId);
    const awayClub = await createTestClub('CA', 'CA', orgId);
    const match = await Match.create({
      organizationId: orgId,
      saisonId: new mongoose.Types.ObjectId(),
      competitionId: new mongoose.Types.ObjectId(),
      journee: 1,
      homeClubId: homeClub._id,
      awayClubId: awayClub._id,
      date: new Date(),
      stade: 'Rades',
      scoreHome: 0,
      scoreAway: 0,
      statut: 'Programmé',
      isOfficial: false,
      homologue: false,
      processingVersion: 1,
    });

    const referee1 = await Arbitre.create({
      nom: 'Srairi',
      prenom: 'Youssef',
      categorie: 'ELITE',
      dateNaissance: new Date('1980-01-01'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      organizationId: orgId,
      status: 'ACTIVE',
      actif: true,
    });

    const referee2 = await Arbitre.create({
      nom: 'Guirat',
      prenom: 'Haythem',
      categorie: 'ELITE',
      dateNaissance: new Date('1990-01-01'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      organizationId: orgId,
      status: 'ACTIVE',
      actif: true,
    });

    // 1. Publish version 1
    await RefereeAssignmentService.saveDraft({
      matchId: match._id.toString(),
      referees: [{ refereeId: referee1._id.toString(), role: 'MAIN' }],
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });
    await RefereeAssignmentService.publish({
      matchId: match._id.toString(),
      version: 1,
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    // 2. Save draft version 2
    await RefereeAssignmentService.saveDraft({
      matchId: match._id.toString(),
      referees: [{ refereeId: referee2._id.toString(), role: 'MAIN' }],
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    // 3. Publish version 2 without reason should fail
    await expect(
      RefereeAssignmentService.publish({
        matchId: match._id.toString(),
        version: 2,
        actorId: mockSession.user.id,
        organizationId: orgId.toString(),
      })
    ).rejects.toThrow('motif');

    // 4. Publish version 2 with reason should succeed
    const published = await RefereeAssignmentService.publish({
      matchId: match._id.toString(),
      version: 2,
      reason: 'Remplacement de dernière minute pour raisons médicales',
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    expect(published.status).toBe('PUBLISHED');
    expect(published.version).toBe(2);

    // 5. Verify version 1 is cancelled
    const v1 = await MatchOfficialAssignment.findOne({ matchId: match._id, version: 1 });
    expect(v1?.status).toBe('CANCELLED');

    // 6. Verify club notifications were sent
    const notifications = await Notification.find({ type: 'REFEREE_ASSIGNMENT_UPDATED' });
    expect(notifications).toHaveLength(2); // One for home, one for away
  });

  it('Cancel updates status to CANCELLED and clears Match fields', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    // Create clubs & match
    const homeClub = await createTestClub('EST', 'EST', orgId);
    const awayClub = await createTestClub('CA', 'CA', orgId);
    const match = await Match.create({
      organizationId: orgId,
      saisonId: new mongoose.Types.ObjectId(),
      competitionId: new mongoose.Types.ObjectId(),
      journee: 1,
      homeClubId: homeClub._id,
      awayClubId: awayClub._id,
      date: new Date(),
      stade: 'Rades',
      scoreHome: 0,
      scoreAway: 0,
      statut: 'Programmé',
      isOfficial: false,
      homologue: false,
      processingVersion: 1,
    });

    const referee = await Arbitre.create({
      nom: 'Srairi',
      prenom: 'Youssef',
      categorie: 'ELITE',
      dateNaissance: new Date('1980-01-01'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      organizationId: orgId,
      status: 'ACTIVE',
      actif: true,
    });

    // 1. Publish version 1
    await RefereeAssignmentService.saveDraft({
      matchId: match._id.toString(),
      referees: [{ refereeId: referee._id.toString(), role: 'MAIN' }],
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });
    await RefereeAssignmentService.publish({
      matchId: match._id.toString(),
      version: 1,
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    // 2. Cancel assignment
    await RefereeAssignmentService.cancel({
      matchId: match._id.toString(),
      version: 1,
      reason: 'Annulation du match / report général',
      actorId: mockSession.user.id,
      organizationId: orgId.toString(),
    });

    const cancelled = await MatchOfficialAssignment.findOne({ matchId: match._id, version: 1 });
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.cancelReason).toBe('Annulation du match / report général');

    // 3. Verify match fields are cleared
    const matchInDb = await Match.findById(match._id);
    expect(matchInDb?.arbitrePrincipalId).toBeUndefined();
    expect(matchInDb?.assistants).toHaveLength(0);

    // 4. Verify notifications sent
    const notifications = await Notification.find({ type: 'REFEREE_ASSIGNMENT_CANCELLED' });
    expect(notifications).toHaveLength(2);
  });
});
