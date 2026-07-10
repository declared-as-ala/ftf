import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Organization from '../lib/models/Organization';
import DisciplinaryRuleSet from '../lib/models/DisciplinaryRuleSet';
import Saison from '../lib/models/Saison';
import Competition from '../lib/models/Competition';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ftf-org-test');

  const { default: connectDB } = await import('../lib/db');
  await connectDB();
  await Organization.init();
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Organization.deleteMany({}),
      DisciplinaryRuleSet.deleteMany({}),
      Saison.deleteMany({}),
      Competition.deleteMany({}),
    ]);
  }
});

describe('Organization Model', () => {
  it('crée une organisation valide', async () => {
    const org = await Organization.create({
      name: 'Fédération Tunisienne de Football',
      code: 'FTF',
      type: 'FEDERATION',
      active: true,
    });

    expect(org._id).toBeDefined();
    expect(org.code).toBe('FTF');
    expect(org.active).toBe(true);
  });

  it('valide l\'unicité du code d\'organisation', async () => {
    await Organization.create({
      name: 'Fédération Tunisienne de Football',
      code: 'FTF',
      type: 'FEDERATION',
      active: true,
    });

    await expect(
      Organization.create({
        name: 'Autre Féd',
        code: 'FTF',
        type: 'FEDERATION',
        active: true,
      })
    ).rejects.toThrow();
  });
});

describe('DisciplinaryRuleSet Model', () => {
  it('crée un règlement disciplinaire valide', async () => {
    const org = await Organization.create({
      name: 'Fédération Tunisienne de Football',
      code: 'FTF',
      type: 'FEDERATION',
      active: true,
    });

    const season = await Saison.create({
      organizationId: org._id,
      nom: 'Saison 2024-2025',
      code: 'S_2024_2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const ruleset = await DisciplinaryRuleSet.create({
      organizationId: org._id,
      seasonId: season._id,
      name: 'Règlement de test',
      version: 1,
      yellowCardThreshold: 3,
      yellowCardSuspensionMatches: 1,
      yellowCardsCountOnlyOfficialMatches: true,
      clearUnusedYellowCardsAtSeasonEnd: true,
      redCardCreatesProvisionalSuspension: true,
      suspensionScope: 'ALL_OFFICIAL_COMPETITIONS',
      friendlyMatchesCount: false,
      effectiveFrom: new Date('2024-09-01'),
      active: true,
    });

    expect(ruleset._id).toBeDefined();
    expect(ruleset.yellowCardThreshold).toBe(3);
    expect(ruleset.suspensionScope).toBe('ALL_OFFICIAL_COMPETITIONS');
  });
});

describe('Saison et Competition avec nouveaux champs', () => {
  it('gère une saison avec ses nouveaux champs optionnels', async () => {
    const org = await Organization.create({
      name: 'Fédération',
      code: 'FED',
      type: 'FEDERATION',
    });

    const season = await Saison.create({
      organizationId: org._id,
      nom: 'Saison 2024-2025',
      code: 'SAISON_2024_2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
      status: 'ACTIVE',
      isCurrent: true,
    });

    expect(season.organizationId).toEqual(org._id);
    expect(season.code).toBe('SAISON_2024_2025');
    expect(season.status).toBe('ACTIVE');
    expect(season.isCurrent).toBe(true);
  });

  it('gère une compétition avec ses nouveaux champs et lien ruleset', async () => {
    const org = await Organization.create({
      name: 'Fédération',
      code: 'FED',
      type: 'FEDERATION',
    });

    const season = await Saison.create({
      organizationId: org._id,
      nom: 'Saison 2024-2025',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const ruleset = await DisciplinaryRuleSet.create({
      organizationId: org._id,
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
      effectiveFrom: new Date('2024-09-01'),
      active: true,
    });

    const comp = await Competition.create({
      organizationId: org._id,
      saisonId: season._id,
      nom: 'Ligue 1',
      code: 'L1',
      type: 'Championnat',
      niveau: 'National',
      dateDebut: new Date('2024-09-15'),
      dateFin: new Date('2025-05-20'),
      clubsParticipants: [],
      formatCompetition: 'Championnat',
      reglementPoints: { victoire: 3, nul: 1, defaite: 0 },
      active: true,
      status: 'ACTIVE',
      isOfficial: true,
      tieBreakers: ['POINTS', 'GOAL_DIFFERENCE'],
      disciplinaryRuleSetId: ruleset._id,
    });

    expect(comp.organizationId).toEqual(org._id);
    expect(comp.code).toBe('L1');
    expect(comp.status).toBe('ACTIVE');
    expect(comp.isOfficial).toBe(true);
    expect(comp.tieBreakers).toContain('POINTS');
    expect(comp.disciplinaryRuleSetId).toEqual(ruleset._id);
  });
});
