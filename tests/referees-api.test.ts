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
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { requireAdmin, ApiError } from '@/lib/api';

// Imports of modules under test
import * as refereesRoute from '../app/api/admin/referees/route';
import * as refereeDetailRoute from '../app/api/admin/referees/[id]/route';

import Arbitre from '../lib/models/Arbitre';
import Organization from '../lib/models/Organization';
import AuditLog from '../lib/models/AuditLog';

let mongod: MongoMemoryServer;

describe('Referees API Registry & CRUD (Sprint 9.1)', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('referees-api-test');
    const { default: connectDB } = await import('../lib/db');
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Arbitre.deleteMany({});
    await Organization.deleteMany({});
    await AuditLog.deleteMany({});
    vi.clearAllMocks();
  });

  it('POST crée un arbitre valide avec Zod validation et écrit un log d\'audit', async () => {
    const payload = {
      nom: 'Jarii',
      prenom: 'Wadii',
      categorie: 'ELITE',
      dateNaissance: '1985-05-15',
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      email: 'wadii@ftf.org.tn',
      status: 'ACTIVE',
      licence: 'LIC-112233',
      region: 'Tunis Nord',
      notes: 'Arbitre international FIFA',
    };

    const req = new Request('http://localhost/api/admin/referees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await refereesRoute.POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body._id).toBeDefined();
    expect(body.nom).toBe('Jarii');
    expect(body.prenom).toBe('Wadii');
    expect(body.displayName).toBe('Wadii Jarii');
    expect(body.licence).toBe('LIC-112233');

    // Vérifier en base
    const refInDb = await Arbitre.findById(body._id);
    expect(refInDb).not.toBeNull();
    expect(refInDb?.organizationId?.toString()).toBe(mockSession.user.organizationId);

    // Vérifier l'audit log
    const audit = await AuditLog.findOne({ action: 'REFEREE_CREATED' });
    expect(audit).not.toBeNull();
    expect(audit?.entityId?.toString()).toBe(body._id);
  });

  it('POST rejette une licence dupliquée pour la même organisation', async () => {
    await Arbitre.create({
      nom: 'Dup',
      prenom: 'Licence',
      categorie: 'ELITE',
      dateNaissance: new Date('1990-01-01'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      licence: 'LIC-DUP',
      organizationId: new mongoose.Types.ObjectId(mockSession.user.organizationId),
      actif: true,
      status: 'ACTIVE',
    });

    const payload = {
      nom: 'Second',
      prenom: 'Licence',
      categorie: 'ELITE',
      dateNaissance: '1990-01-01',
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      licence: 'LIC-DUP',
    };

    const req = new Request('http://localhost/api/admin/referees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await refereesRoute.POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('licence');
  });

  it('GET liste les arbitres avec pagination, recherche et scoping d\'organisation', async () => {
    // Arbitre org A
    await Arbitre.create({
      nom: 'A1',
      prenom: 'Arbitre',
      categorie: 'ELITE',
      dateNaissance: new Date('1985-05-15'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      licence: 'LIC-A1',
      organizationId: new mongoose.Types.ObjectId(mockSession.user.organizationId),
      actif: true,
      status: 'ACTIVE',
      displayName: 'Arbitre A1',
      region: 'Sousse',
    });

    // Arbitre org B (autre)
    await Arbitre.create({
      nom: 'B1',
      prenom: 'Arbitre',
      categorie: 'ELITE',
      dateNaissance: new Date('1985-05-15'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      licence: 'LIC-B1',
      organizationId: new mongoose.Types.ObjectId(),
      actif: true,
      status: 'ACTIVE',
      displayName: 'Arbitre B1',
    });

    const req = new Request('http://localhost/api/admin/referees?q=A1');
    const res = await refereesRoute.GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.referees).toHaveLength(1);
    expect(body.referees[0].nom).toBe('A1');
    expect(body.total).toBe(1);
  });

  it('PUT met à jour un arbitre existant et enregistre l\'audit', async () => {
    const created = await Arbitre.create({
      nom: 'OldNom',
      prenom: 'OldPrenom',
      categorie: 'ELITE',
      dateNaissance: new Date('1985-05-15'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      licence: 'LIC-UPDATE',
      organizationId: new mongoose.Types.ObjectId(mockSession.user.organizationId),
      actif: true,
      status: 'ACTIVE',
      displayName: 'OldPrenom OldNom',
    });

    const payload = {
      nom: 'NewNom',
      prenom: 'NewPrenom',
      categorie: 'ELITE',
      dateNaissance: '1985-05-15',
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      licence: 'LIC-UPDATE',
      status: 'UNAVAILABLE',
    };

    const req = new Request(`http://localhost/api/admin/referees/${created._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await refereeDetailRoute.PUT(req, { params: Promise.resolve({ id: created._id.toString() }) });
    expect(res.status).toBe(200);

    const updated = await Arbitre.findById(created._id);
    expect(updated?.nom).toBe('NewNom');
    expect(updated?.status).toBe('UNAVAILABLE');
    expect(updated?.actif).toBe(false);

    // Vérifier l'audit log
    const audit = await AuditLog.findOne({ action: 'REFEREE_UPDATED' });
    expect(audit).not.toBeNull();
    expect(audit?.before).toBeDefined();
    expect(audit?.after).toBeDefined();
  });

  it('DELETE effectue un archivage doux (soft-archive) sans suppression physique', async () => {
    const created = await Arbitre.create({
      nom: 'Arch',
      prenom: 'Me',
      categorie: 'ELITE',
      dateNaissance: new Date('1985-05-15'),
      nationalite: 'Tunisienne',
      ville: 'Tunis',
      licence: 'LIC-ARCH',
      organizationId: new mongoose.Types.ObjectId(mockSession.user.organizationId),
      actif: true,
      status: 'ACTIVE',
      displayName: 'Me Arch',
    });

    const req = new Request(`http://localhost/api/admin/referees/${created._id}`, {
      method: 'DELETE',
    });

    const res = await refereeDetailRoute.DELETE(req, { params: Promise.resolve({ id: created._id.toString() }) });
    expect(res.status).toBe(200);

    // Vérifier que le statut est ARCHIVED et actif est false
    const refInDb = await Arbitre.findById(created._id);
    expect(refInDb).not.toBeNull();
    expect(refInDb?.status).toBe('ARCHIVED');
    expect(refInDb?.actif).toBe(false);

    // Vérifier que l'audit log est présent
    const audit = await AuditLog.findOne({ action: 'REFEREE_ARCHIVED' });
    expect(audit).not.toBeNull();
  });

  it('Rejette les accès si l\'utilisateur n\'est pas administrateur', async () => {
    vi.mocked(requireAdmin).mockImplementationOnce(async () => {
      throw new ApiError(403, 'Forbidden');
    });

    const req = new Request('http://localhost/api/admin/referees');
    const res = await refereesRoute.GET(req);
    expect(res.status).toBe(403);
  });
});
