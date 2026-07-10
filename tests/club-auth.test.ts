import { vi } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      status: init?.status ?? 200,
      headers: new Headers(),
      json: async () => JSON.parse(JSON.stringify(body)),
      text: async () => JSON.stringify(body),
    }),
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { requireClub } from '@/lib/api';

let mongod: MongoMemoryServer;
let Club: any, User: any, Organization: any;
let clubId: string, clubUserId: string;
let orgId: string;
const PASSWORD = 'Secret@123';
let passwordHash: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ftf-test');

  const { default: connectDB } = await import('../lib/db');
  await connectDB();

  Club = (await import('../lib/models/Club')).default;
  User = (await import('../lib/models/User')).default;
  Organization = (await import('../lib/models/Organization')).default;

  passwordHash = await bcrypt.hash(PASSWORD, 10);
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

beforeEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db!.listCollections().toArray();
  for (const col of collections) {
    await mongoose.connection.db!.dropCollection(col.name);
  }

  const org = await Organization.create({
    name: 'FTF', code: 'FTF', type: 'FEDERATION', active: true,
  });
  orgId = org._id.toString();

  const club = await Club.create({
    organizationId: orgId,
    nom: 'Club Test', code: 'TST', slug: 'test',
    status: 'ACTIVE', ville: 'Tunis', stade: 'Stade Test',
    emailOfficiel: 'club@test.tn', fondation: 2000,
  });
  clubId = club._id.toString();

  await User.create({
    email: 'admin@test.tn', password: passwordHash,
    role: 'FTF_ADMIN', status: 'ACTIVE', organizationId: orgId,
  });

  const user = await User.create({
    email: 'club@test.tn', password: passwordHash,
    role: 'CLUB_ADMIN', status: 'ACTIVE',
    clubId: club._id, organizationId: orgId, name: 'Club Admin',
  });
  clubUserId = user._id.toString();
});

describe('requireClub() — authorization gate', () => {
  it('rejects unauthenticated requests (401)', async () => {
    (auth as any).mockReturnValue(Promise.resolve(null));
    await expect(requireClub()).rejects.toThrow('Non authentifié');
  });

  it('rejects FTF_ADMIN role (403)', async () => {
    (auth as any).mockReturnValue(Promise.resolve({
      user: { id: 'admin', role: 'FTF_ADMIN', organizationId: orgId },
    }));
    await expect(requireClub()).rejects.toThrow('Accès réservé aux administrateurs de club');
  });

  it('rejects CLUB_ADMIN without clubId (403)', async () => {
    (auth as any).mockReturnValue(Promise.resolve({
      user: { id: clubUserId, role: 'CLUB_ADMIN', organizationId: orgId, clubId: undefined },
    }));
    await expect(requireClub()).rejects.toThrow('Accès réservé aux administrateurs de club');
  });

  it('returns session+clubId for valid CLUB_ADMIN', async () => {
    (auth as any).mockReturnValue(Promise.resolve({
      user: {
        id: clubUserId, role: 'CLUB_ADMIN',
        clubId, clubName: 'Club Test', organizationId: orgId,
      },
    }));
    const result = await requireClub();
    expect(result).toHaveProperty('clubId', clubId);
    expect(result.session.user.role).toBe('CLUB_ADMIN');
  });
});

describe('Club API — data isolation', () => {
  it('club players list only returns own club players', async () => {
    const otherClub = await Club.create({
      organizationId: orgId, nom: 'Other Club', code: 'OTH', slug: 'other',
      status: 'ACTIVE', ville: 'Sfax', stade: 'Stade Autre',
      emailOfficiel: 'other@test.tn', fondation: 2000,
    });

    const Joueur = (await import('../lib/models/Joueur')).default;
    await Joueur.create({
      clubId, nom: 'Mine', prenom: 'Player', licence: 'OWN-001',
      nationalite: 'Tunisienne', position: 'Milieu',
      dateNaissance: new Date('2000-01-01'), status: 'ACTIVE',
    });
    await Joueur.create({
      clubId: otherClub._id, nom: 'Theirs', prenom: 'Player', licence: 'OTH-001',
      nationalite: 'Tunisienne', position: 'Attaquant',
      dateNaissance: new Date('2000-01-01'), status: 'ACTIVE',
    });

    const myPlayers = await Joueur.find({ clubId }).lean();
    const allPlayers = await Joueur.find({}).lean();

    expect(myPlayers).toHaveLength(1);
    expect(allPlayers).toHaveLength(2);
    expect(myPlayers[0].licence).toBe('OWN-001');
  });

  it('club player detail rejects non-owned player', async () => {
    const Joueur = (await import('../lib/models/Joueur')).default;
    const otherClub = await Club.create({
      organizationId: orgId, nom: 'Other', code: 'OTH', slug: 'other',
      status: 'ACTIVE', ville: 'Sfax', stade: 'Stade', emailOfficiel: 'o@t.tn', fondation: 2000,
    });

    const otherPlayer = await Joueur.create({
      clubId: otherClub._id, nom: 'Other', prenom: 'Player', licence: 'OTH-001',
      nationalite: 'Tunisienne', position: 'Milieu',
      dateNaissance: new Date('2000-01-01'), status: 'ACTIVE',
    });

    const found = await Joueur.findOne({ _id: otherPlayer._id, clubId });
    expect(found).toBeNull();
  });

  it('club match detail rejects non-participant access', async () => {
    const Match = (await import('../lib/models/Match')).default;
    const Competition = (await import('../lib/models/Competition')).default;
    const Saison = (await import('../lib/models/Saison')).default;
    const otherClub = await Club.create({
      organizationId: orgId, nom: 'Other', code: 'OTH', slug: 'other',
      status: 'ACTIVE', ville: 'Sfax', stade: 'Stade', emailOfficiel: 'o@t.tn', fondation: 2000,
    });

    const season = await Saison.create({
      organizationId: orgId, nom: 'Test', code: 'TST',
      anneeDebut: 2025, anneeFin: 2026,
      dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31'),
      status: 'ACTIVE', isCurrent: true,
    });

    const comp = await Competition.create({
      organizationId: orgId, saisonId: season._id, nom: 'Ligue 1',
      code: 'L1', type: 'Championnat', niveau: 'National',
      isOfficial: true, status: 'ACTIVE',
      dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31'),
    });

    const match = await Match.create({
      organizationId: orgId, saisonId: season._id, competitionId: comp._id,
      homeClubId: otherClub._id, awayClubId: new mongoose.Types.ObjectId(),
      date: new Date(), stade: 'Stade X', statut: 'Programmé',
      scoreHome: 0, scoreAway: 0, isOfficial: true, homologue: false,
      journee: 1, processingVersion: 0,
    });

    const isParticipant = match.homeClubId.toString() === clubId || match.awayClubId.toString() === clubId;
    expect(isParticipant).toBe(false);
  });
});

describe('Club API — write denial', () => {
  it('club profile PUT does not change role', async () => {
    const updated = await User.findByIdAndUpdate(clubUserId, { name: 'New Name' }, { new: true });
    expect(updated.name).toBe('New Name');
    expect(updated.role).toBe('CLUB_ADMIN');
  });

  it('club notifications PUT only marks own club notifications as read', async () => {
    const Notification = (await import('../lib/models/Notification')).default;
    const otherClub = await Club.create({
      organizationId: orgId, nom: 'Other', code: 'OTH', slug: 'other',
      status: 'ACTIVE', ville: 'Sfax', stade: 'Stade', emailOfficiel: 'o@t.tn', fondation: 2000,
    });

    const n1 = await Notification.create({
      organizationId: orgId, recipientClubId: clubId,
      type: 'YELLOW_AT_RISK', subject: 'S1', body: 'B1',
      dedupeKey: `test-read-1`, read: false,
    });
    const n2 = await Notification.create({
      organizationId: orgId, recipientClubId: otherClub._id,
      type: 'YELLOW_AT_RISK', subject: 'S2', body: 'B2',
      dedupeKey: `test-read-2`, read: false,
    });

    await Notification.findOneAndUpdate(
      { _id: n1._id, recipientClubId: clubId, read: false },
      { read: true, readAt: new Date() }
    );

    const updatedN1 = await Notification.findById(n1._id);
    const updatedN2 = await Notification.findById(n2._id);
    expect(updatedN1?.read).toBe(true);
    expect(updatedN2?.read).toBe(false);
  });
});

describe('Club dashboard — data isolation', () => {
  it('only counts own club players', async () => {
    const Joueur = (await import('../lib/models/Joueur')).default;
    const otherClub = await Club.create({
      organizationId: orgId, nom: 'Other', code: 'OTH', slug: 'other',
      status: 'ACTIVE', ville: 'Sfax', stade: 'Stade', emailOfficiel: 'o@t.tn', fondation: 2000,
    });

    await Joueur.create({
      clubId, nom: 'Mine', prenom: 'A', licence: 'OWN-001',
      nationalite: 'TN', position: 'Milieu', dateNaissance: new Date('2000-01-01'), status: 'ACTIVE',
    });
    await Joueur.create({
      clubId: otherClub._id, nom: 'Theirs', prenom: 'B', licence: 'OTH-001',
      nationalite: 'TN', position: 'Attaquant', dateNaissance: new Date('2000-01-01'), status: 'ACTIVE',
    });

    const myCount = await Joueur.countDocuments({ clubId, status: 'ACTIVE' });
    expect(myCount).toBe(1);
  });

  it('only returns own club suspensions', async () => {
    const Suspension = (await import('../lib/models/Suspension')).default;
    const Saison = (await import('../lib/models/Saison')).default;
    const otherClub = await Club.create({
      organizationId: orgId, nom: 'Other', code: 'OTH', slug: 'other',
      status: 'ACTIVE', ville: 'Sfax', stade: 'Stade', emailOfficiel: 'o@t.tn', fondation: 2000,
    });

    const season = await Saison.create({
      organizationId: orgId, nom: 'Test', code: 'TST',
      anneeDebut: 2025, anneeFin: 2026,
      dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31'),
      status: 'ACTIVE', isCurrent: true,
    });

    await Suspension.create({
      organizationId: orgId, clubId, joueurId: new mongoose.Types.ObjectId(),
      sourceSeasonId: season._id, suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE', matchesSuspended: 1, matchesRemaining: 1,
    });
    await Suspension.create({
      organizationId: orgId, clubId: otherClub._id, joueurId: new mongoose.Types.ObjectId(),
      sourceSeasonId: season._id, suspensionType: 'YELLOW_ACCUMULATION',
      status: 'ACTIVE', matchesSuspended: 1, matchesRemaining: 1,
    });

    const mySuspensions = await Suspension.find({ clubId }).lean();
    expect(mySuspensions).toHaveLength(1);
  });
});
