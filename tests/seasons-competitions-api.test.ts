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
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

// Imports des modules sous test
import * as seasonsRoute from '../app/api/admin/seasons/route';
import * as seasonDetailRoute from '../app/api/admin/seasons/[id]/route';
import * as seasonActionRoute from '../app/api/admin/seasons/[id]/[action]/route';
import * as competitionsRoute from '../app/api/admin/competitions/route';
import * as compDetailRoute from '../app/api/admin/competitions/[id]/route';
import * as compClubsRoute from '../app/api/admin/competitions/[id]/clubs/route';

import Saison from '../lib/models/Saison';
import Competition from '../lib/models/Competition';
import Club from '../lib/models/Club';
import DisciplinaryRuleSet from '../lib/models/DisciplinaryRuleSet';
import Organization from '../lib/models/Organization';

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ftf-api-test');

  const { default: connectDB } = await import('../lib/db');
  await connectDB();
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
      DisciplinaryRuleSet.deleteMany({}),
    ]);
  }
});

describe('Seasons API Route Handlers', () => {
  it('GET retourne les saisons de l\'organisation', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    // Saison de l'organisation
    await Saison.create({
      organizationId: orgId,
      nom: 'Saison 1',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    // Saison d'une autre organisation
    await Saison.create({
      organizationId: new mongoose.Types.ObjectId(),
      nom: 'Saison Autre',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const req = new Request('http://localhost/api/admin/seasons');
    const res = await seasonsRoute.GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].nom).toBe('Saison 1');
  });

  it('POST crée une saison avec code et règlements automatiques', async () => {
    const body = {
      nom: 'Saison 2025-2026',
      anneeDebut: 2025,
      anneeFin: 2026,
      dateDebut: '2025-09-01T00:00:00.000Z',
      dateFin: '2026-05-31T00:00:00.000Z',
      configuration: {
        seuilCartonsJaunes: 3,
        suspensionCartonRouge: 1,
        suspensionStaff: 1,
      },
    };

    const req = new Request('http://localhost/api/admin/seasons', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const res = await seasonsRoute.POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.code).toBe('SAISON_2025_2026');
    expect(data.status).toBe('DRAFT');

    // Vérifier le règlement disciplinaire créé automatiquement
    const ruleset = await DisciplinaryRuleSet.findOne({ seasonId: data._id });
    expect(ruleset).not.toBeNull();
    expect(ruleset!.yellowCardThreshold).toBe(3);
  });

  it('PUT met à jour une saison', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);
    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison Originale',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const req = new Request(`http://localhost/api/admin/seasons/${season._id}`, {
      method: 'PUT',
      body: JSON.stringify({ nom: 'Saison Modifiée' }),
    });

    const res = await seasonDetailRoute.PUT(req, { params: Promise.resolve({ id: season._id.toString() }) });
    expect(res.status).toBe(200);

    const updated = await Saison.findById(season._id);
    expect(updated!.nom).toBe('Saison Modifiée');
  });

  it('DELETE rejette si la saison a des compétitions, supprime sinon', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);
    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison A Supprimer',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    // Lier une compétition
    await Competition.create({
      organizationId: orgId,
      nom: 'Ligue 1',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id,
      dateDebut: new Date('2024-09-15'),
      dateFin: new Date('2025-05-20'),
      clubsParticipants: [],
    });

    const req = new Request(`http://localhost/api/admin/seasons/${season._id}`, {
      method: 'DELETE',
    });

    const res1 = await seasonDetailRoute.DELETE(req, { params: Promise.resolve({ id: season._id.toString() }) });
    expect(res1.status).toBe(400);

    // Supprimer la compétition et re-tester
    await Competition.deleteMany({});
    const res2 = await seasonDetailRoute.DELETE(req, { params: Promise.resolve({ id: season._id.toString() }) });
    expect(res2.status).toBe(200);

    const exists = await Saison.findById(season._id);
    expect(exists).toBeNull();
  });
});

describe('Seasons Custom Actions Handlers', () => {
  it('action activate active la saison et désactive les autres', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const s1 = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 1',
      code: 'S1',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
      isCurrent: true,
    });

    const s2 = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 2',
      code: 'S2',
      anneeDebut: 2025,
      anneeFin: 2026,
      dateDebut: new Date('2025-09-01'),
      dateFin: new Date('2026-05-31'),
      active: false,
      isCurrent: false,
      status: 'DRAFT',
    });

    const req = new Request(`http://localhost/api/admin/seasons/${s2._id}/activate`, {
      method: 'POST',
    });

    const res = await seasonActionRoute.POST(req, { params: Promise.resolve({ id: s2._id.toString(), action: 'activate' }) });
    expect(res.status).toBe(200);

    const fresh1 = await Saison.findById(s1._id);
    const fresh2 = await Saison.findById(s2._id);

    expect(fresh1!.isCurrent).toBe(false);
    expect(fresh1!.active).toBe(false);

    expect(fresh2!.isCurrent).toBe(true);
    expect(fresh2!.active).toBe(true);
    expect(fresh2!.status).toBe('ACTIVE');
  });
});

describe('Competitions API Route Handlers', () => {
  it('POST crée une compétition et lie le ruleset automatiquement', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 2024-2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const ruleset = await DisciplinaryRuleSet.create({
      organizationId: orgId,
      seasonId: season._id,
      name: 'Règlement',
      version: 1,
      yellowCardThreshold: 3,
      yellowCardSuspensionMatches: 1,
      yellowCardsCountOnlyOfficialMatches: true,
      clearUnusedYellowCardsAtSeasonEnd: true,
      redCardCreatesProvisionalSuspension: true,
      suspensionScope: 'ALL_OFFICIAL_COMPETITIONS',
      friendlyMatchesCount: false,
      effectiveFrom: season.dateDebut,
      active: true,
    });

    const body = {
      nom: 'Ligue 1 Professionnelle',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id.toString(),
    };

    const req = new Request('http://localhost/api/admin/competitions', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const res = await competitionsRoute.POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.disciplinaryRuleSetId).toBe(ruleset._id.toString());
    expect(data.code).toBe('LIGUE_1_PROFESSIONNELLE');

    // Vérifier que la compétition a été ajoutée à la saison
    const updatedSeason = await Saison.findById(season._id);
    expect(updatedSeason!.competitions.map(c => c.toString())).toContain(data._id);
  });

  it('POST enregistre les clubs participants', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 2024-2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const comp = await Competition.create({
      organizationId: orgId,
      nom: 'Compétition',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id,
      dateDebut: season.dateDebut,
      dateFin: season.dateFin,
      clubsParticipants: [],
    });

    const club1 = await Club.create({
      organizationId: orgId,
      nom: 'Club 1',
      stade: 'Stade 1',
      ville: 'Ville 1',
      fondation: 1919,
      emailOfficiel: 'club1@test.tn',
    });

    const club2 = await Club.create({
      organizationId: orgId,
      nom: 'Club 2',
      stade: 'Stade 2',
      ville: 'Ville 2',
      fondation: 1920,
      emailOfficiel: 'club2@test.tn',
    });

    const req = new Request(`http://localhost/api/admin/competitions/${comp._id}/clubs`, {
      method: 'POST',
      body: JSON.stringify({
        clubIds: [club1._id.toString(), club2._id.toString()],
      }),
    });

    const res = await compClubsRoute.POST(req, { params: Promise.resolve({ id: comp._id.toString() }) });
    expect(res.status).toBe(200);

    const updated = await Competition.findById(comp._id);
    expect(updated!.clubsParticipants.length).toBe(2);
    expect(updated!.clubsParticipants.map(id => id.toString())).toContain(club1._id.toString());
  });
});
