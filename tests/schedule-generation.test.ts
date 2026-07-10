import { vi } from 'vitest';

// 1. Mock next/server et @/lib/auth avant tout autre import pour éviter les erreurs de résolution Next/NextAuth
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

// Imports des modules sous test
import ScheduleGenerationService from '../lib/services/schedule-generation.service';
import * as generateCalendarRoute from '../app/api/admin/competitions/[id]/generate-calendar/route';
import * as roundsRoute from '../app/api/admin/rounds/route';

import Saison from '../lib/models/Saison';
import Competition from '../lib/models/Competition';
import Club from '../lib/models/Club';
import Round from '../lib/models/Round';
import Match from '../lib/models/Match';
import Organization from '../lib/models/Organization';

let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  // Start as a replica set to support transactions in tests
  mongod = await MongoMemoryReplSet.create({
    replSet: { dbName: 'ftf-schedule-test', count: 1 }
  });
  process.env.MONGODB_URI = mongod.getUri();

  const { default: connectDB } = await import('../lib/db');
  await connectDB();
  await Organization.init();
  await Round.init();
  await Match.init();
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Organization.deleteMany({}),
      Saison.deleteMany({}),
      Competition.deleteMany({}),
      Club.deleteMany({}),
      Round.deleteMany({}),
      Match.deleteMany({}),
    ]);
  }
});

describe('ScheduleGenerationService Unit & Integration Tests', () => {
  it('génère un calendrier double leg pour un nombre pair de clubs (6 clubs)', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);
    
    // Seed Season & Competition
    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 2024-2025',
      code: 'S2024_2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    // Seed 6 clubs
    const clubIds: mongoose.Types.ObjectId[] = [];
    for (let i = 1; i <= 6; i++) {
      const club = await Club.create({
        organizationId: orgId,
        nom: `Club ${i}`,
        stade: `Stade ${i}`,
        ville: `Ville ${i}`,
        fondation: 1920 + i,
        emailOfficiel: `club${i}@test.tn`,
        code: `C${i}`,
      });
      clubIds.push(club._id as mongoose.Types.ObjectId);
    }

    const competition = await Competition.create({
      organizationId: orgId,
      nom: 'Ligue 1',
      code: 'L1',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id,
      dateDebut: season.dateDebut,
      dateFin: season.dateFin,
      clubsParticipants: clubIds,
      formatCompetition: 'Championnat',
    });

    // Générer
    const result = await ScheduleGenerationService.generateCalendar({
      competitionId: competition._id,
      organizationId: orgId,
      actorId: mockSession.user.id,
      doubleLeg: true,
      startDate: new Date('2024-09-07'),
    });

    expect(result.roundsCount).toBe(10); // (6 - 1) * 2 = 10 rounds
    expect(result.matchesCount).toBe(30); // 10 rounds * 3 matches = 30 matches

    // Vérifier les matches créés
    const matches = await Match.find({ competitionId: competition._id });
    expect(matches.length).toBe(30);

    // Vérifier l'alternance et l'unicité
    // Chaque club doit jouer exactement 1 match par journée
    for (let r = 1; r <= 10; r++) {
      const roundMatches = matches.filter((m) => m.journee === r);
      expect(roundMatches.length).toBe(3); // 6 clubs / 2 = 3 matches

      const playedClubs = new Set<string>();
      for (const m of roundMatches) {
        expect(m.homeClubId.toString()).not.toBe(m.awayClubId.toString());
        playedClubs.add(m.homeClubId.toString());
        playedClubs.add(m.awayClubId.toString());
      }
      expect(playedClubs.size).toBe(6); // Tous les 6 clubs ont joué
    }

    // Vérifier que sur la phase retour (Rounds 6 à 10), les domiciles/extérieurs sont inversés par rapport aux allers (Rounds 1 à 5)
    const r1Matches = matches.filter((m) => m.journee === 1);
    const r6Matches = matches.filter((m) => m.journee === 6);

    for (const m1 of r1Matches) {
      const counterpart = r6Matches.find(
        (m6) =>
          m6.homeClubId.toString() === m1.awayClubId.toString() &&
          m6.awayClubId.toString() === m1.homeClubId.toString()
      );
      expect(counterpart).toBeDefined();
    }
  });

  it('génère un calendrier simple leg pour un nombre impair de clubs (5 clubs)', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 2024-2025',
      code: 'S2024_2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const clubIds: mongoose.Types.ObjectId[] = [];
    for (let i = 1; i <= 5; i++) {
      const club = await Club.create({
        organizationId: orgId,
        nom: `Club ${i}`,
        stade: `Stade ${i}`,
        ville: `Ville ${i}`,
        fondation: 1920 + i,
        emailOfficiel: `club${i}@test.tn`,
        code: `C${i}`,
      });
      clubIds.push(club._id as mongoose.Types.ObjectId);
    }

    const competition = await Competition.create({
      organizationId: orgId,
      nom: 'Ligue 1',
      code: 'L1',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id,
      dateDebut: season.dateDebut,
      dateFin: season.dateFin,
      clubsParticipants: clubIds,
      formatCompetition: 'Championnat',
    });

    const result = await ScheduleGenerationService.generateCalendar({
      competitionId: competition._id,
      organizationId: orgId,
      actorId: mockSession.user.id,
      doubleLeg: false, // Simple Leg
      startDate: new Date('2024-09-07'),
    });

    expect(result.roundsCount).toBe(5); // 5 clubs impair => N=6 virtuel => 5 rounds
    expect(result.matchesCount).toBe(10); // 5 rounds * 2 matches = 10 matches (1 club au repos par round)

    const matches = await Match.find({ competitionId: competition._id });
    expect(matches.length).toBe(10);

    for (let r = 1; r <= 5; r++) {
      const roundMatches = matches.filter((m) => m.journee === r);
      expect(roundMatches.length).toBe(2); // 2 matches, 4 clubs jouant, 1 club au repos

      const playedClubs = new Set<string>();
      for (const m of roundMatches) {
        playedClubs.add(m.homeClubId.toString());
        playedClubs.add(m.awayClubId.toString());
      }
      expect(playedClubs.size).toBe(4);
    }
  });

  it('refuse la génération si des rencontres existent déjà', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 2024-2025',
      code: 'S2024_2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const clubs = [
      await Club.create({ organizationId: orgId, nom: 'Club A', code: 'CA', ville: 'V', stade: 'S', emailOfficiel: 'a@t.tn', fondation: 1919 }),
      await Club.create({ organizationId: orgId, nom: 'Club B', code: 'CB', ville: 'V', stade: 'S', emailOfficiel: 'b@t.tn', fondation: 1919 }),
    ];

    const competition = await Competition.create({
      organizationId: orgId,
      nom: 'Ligue 1',
      code: 'L1',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id,
      dateDebut: season.dateDebut,
      dateFin: season.dateFin,
      clubsParticipants: clubs.map((c) => c._id),
      formatCompetition: 'Championnat',
    });

    // Créer un match manuel existant
    await Match.create({
      organizationId: orgId,
      saisonId: season._id,
      competitionId: competition._id,
      journee: 1,
      homeClubId: clubs[0]._id,
      awayClubId: clubs[1]._id,
      date: new Date(),
      stade: 'Stade',
      scoreHome: 0,
      scoreAway: 0,
      statut: 'Programmé',
    });

    await expect(
      ScheduleGenerationService.generateCalendar({
        competitionId: competition._id,
        organizationId: orgId,
        actorId: mockSession.user.id,
        doubleLeg: true,
      })
    ).rejects.toThrow('Un calendrier existe déjà pour cette compétition');
  });
});

describe('Rounds & Generate Calendar API Endpoints', () => {
  it('POST /competitions/[id]/generate-calendar déclenche la génération et renvoie 200', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 2024-2025',
      code: 'S2024_2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const clubs = [
      await Club.create({ organizationId: orgId, nom: 'Club A', code: 'CA', ville: 'V', stade: 'S', emailOfficiel: 'a@t.tn', fondation: 1919 }),
      await Club.create({ organizationId: orgId, nom: 'Club B', code: 'CB', ville: 'V', stade: 'S', emailOfficiel: 'b@t.tn', fondation: 1919 }),
    ];

    const competition = await Competition.create({
      organizationId: orgId,
      nom: 'Ligue 1',
      code: 'L1',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id,
      dateDebut: season.dateDebut,
      dateFin: season.dateFin,
      clubsParticipants: clubs.map((c) => c._id),
      formatCompetition: 'Championnat',
    });

    const body = {
      doubleLeg: false,
      startDate: '2024-09-10T12:00:00.000Z',
    };

    const req = new Request(`http://localhost/api/admin/competitions/${competition._id}/generate-calendar`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const res = await generateCalendarRoute.POST(req, { params: Promise.resolve({ id: competition._id.toString() }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.roundsCount).toBe(1); // 2 clubs, simple leg => 1 round
    expect(data.matchesCount).toBe(1);

    // Vérifier les rounds créés en base
    const roundsInDb = await Round.find({ competitionId: competition._id });
    expect(roundsInDb.length).toBe(1);
    expect(roundsInDb[0].number).toBe(1);
  });

  it('GET /rounds liste les rounds de la compétition', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const r = await Round.create({
      organizationId: orgId,
      competitionId: new mongoose.Types.ObjectId(),
      saisonId: new mongoose.Types.ObjectId(),
      number: 5,
      name: 'Journée 5',
      dateDebut: new Date(),
      dateFin: new Date(),
      status: 'SCHEDULED',
      active: true,
    });

    const req = new Request('http://localhost/api/admin/rounds');
    const res = await roundsRoute.GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].name).toBe('Journée 5');
  });
});
