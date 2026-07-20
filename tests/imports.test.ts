import { vi } from 'vitest';

// 1. Mock next/server et @/lib/auth avant tout autre import pour éviter les erreurs de Next/NextAuth
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

let mongod: MongoMemoryServer;

import * as importsRoute from '../app/api/admin/imports/route';

import Saison from '../lib/models/Saison';
import Competition from '../lib/models/Competition';
import Club from '../lib/models/Club';
import Joueur from '../lib/models/Joueur';
import Match from '../lib/models/Match';
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
      Joueur.deleteMany({}),
      Match.deleteMany({}),
    ]);
  }
});

describe('CSV Imports API Route Handlers', () => {
  it('GET retourne les informations de gabarits', async () => {
    const req = new Request('http://localhost/api/admin/imports');
    const res = await importsRoute.GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.templates.length).toBe(4);
    expect(data.templates.map((t: any) => t.entity)).toContain('clubs');
    expect(data.templates.map((t: any) => t.entity)).toContain('players');
  });

  it('GET permet de télécharger un modèle CSV', async () => {
    const req = new Request('http://localhost/api/admin/imports?entity=clubs&download=template');
    const res = await importsRoute.GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
  });

  it('POST valide les clubs et vérifie les formats incorrects', async () => {
    const csvContent = [
      'nom,code,slug,stade,ville,emailOfficiel,fondation,couleurs,siteweb,telephone',
      'Club Sportif EST,EST,est,Rades,Tunis,est@est.tn,1919,Rouge,http://est.tn,+216',
      'Club Invalide,INV,inv,Municipal,Sousse,email-invalide,abc,,,'
    ].join('\n');

    const file = new File([csvContent], 'clubs.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('entity', 'clubs');
    formData.append('file', file);
    formData.append('mode', 'validate');

    const req = new Request('http://localhost/api/admin/imports', {
      method: 'POST',
      body: formData,
    });

    const res = await importsRoute.POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.totalRows).toBe(2);
    expect(data.validCount).toBe(1);
    expect(data.errorCount).toBe(1);

    const preview = data.preview;
    expect(preview[0].valid).toBe(true);
    expect(preview[1].valid).toBe(false);
    expect(preview[1].errors.join(' ')).toContain('Email "email-invalide" invalide');
    expect(preview[1].errors.join(' ')).toContain('Année de fondation "abc" invalide');
  });

  it('POST traite et importe les clubs en base après validation', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const csvContent = [
      'nom,code,slug,stade,ville,emailOfficiel,fondation,couleurs,siteweb,telephone',
      'Club Sportif EST,EST,est,Rades,Tunis,est@est.tn,1919,Rouge,http://est.tn,+216'
    ].join('\n');

    const file = new File([csvContent], 'clubs.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('entity', 'clubs');
    formData.append('file', file);
    formData.append('mode', 'process');
    formData.append('allow', 'true');

    const req = new Request('http://localhost/api/admin/imports', {
      method: 'POST',
      body: formData,
    });

    const res = await importsRoute.POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.result.created).toBe(1);

    const club = await Club.findOne({ code: 'EST', organizationId: orgId });
    expect(club).not.toBeNull();
    expect(club!.nom).toBe('Club Sportif EST');
  });

  it('POST valide et importe des joueurs avec vérification du club et warnings si licence existante', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const club = await Club.create({
      organizationId: orgId,
      nom: 'Espérance',
      code: 'EST',
      stade: 'Rades',
      ville: 'Tunis',
      fondation: 1919,
      emailOfficiel: 'est@est.tn',
    });

    await Joueur.create({
      organizationId: orgId,
      nom: 'Existant',
      prenom: 'Joueur',
      licence: 'LIC-001',
      clubId: club._id,
      position: 'Milieu',
      nationalite: 'Tunisienne',
      dateNaissance: new Date('1998-05-12'),
      status: 'ACTIVE',
    });

    const csvContent = [
      'nom,prenom,licence,nationalite,position,clubCode,dateNaissance,numeroMaillot,piedPrefere',
      'Nouveau,Joueur,LIC-002,Tunisienne,Gardien,EST,2002-10-10,1,Droit',
      'Modifie,Joueur,LIC-001,Tunisienne,Attaquant,EST,1998-05-12,9,Gauche',
      'Invalide,Club,LIC-003,Tunisienne,Milieu,ABSENT,2000-01-01,10,Droit'
    ].join('\n');

    const file = new File([csvContent], 'players.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('entity', 'players');
    formData.append('file', file);
    formData.append('mode', 'validate');

    const req = new Request('http://localhost/api/admin/imports', {
      method: 'POST',
      body: formData,
    });

    const res = await importsRoute.POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.totalRows).toBe(3);
    expect(data.validCount).toBe(2);
    expect(data.errorCount).toBe(1);

    const preview = data.preview;
    expect(preview[0].valid).toBe(true);
    expect(preview[1].valid).toBe(true);
    expect(preview[1].warnings[0]).toContain('existe déjà et sera mis à jour');
    expect(preview[2].valid).toBe(false);
    expect(preview[2].errors[0]).toContain('Club "ABSENT" introuvable');
  });

  it('POST valide et importe des matchs (fixtures)', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 1',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    await Competition.create({
      organizationId: orgId,
      nom: 'Ligue 1',
      code: 'L1',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id,
      dateDebut: season.dateDebut,
      dateFin: season.dateFin,
      clubsParticipants: [],
    });

    await Club.create({
      organizationId: orgId,
      nom: 'Espérance',
      code: 'EST',
      stade: 'Rades',
      ville: 'Tunis',
      fondation: 1919,
      emailOfficiel: 'est@est.tn',
    });

    await Club.create({
      organizationId: orgId,
      nom: 'Club Africain',
      code: 'CA',
      stade: 'El Menzah',
      ville: 'Tunis',
      fondation: 1920,
      emailOfficiel: 'ca@ca.tn',
    });

    const csvContent = [
      'competitionCode,journee,date,heure,stade,homeClubCode,awayClubCode',
      'L1,1,2025-08-15,16:00,Stade Rades,EST,CA',
      'L1,1,2025-08-15,16:00,Stade Rades,EST,EST'
    ].join('\n');

    const file = new File([csvContent], 'fixtures.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('entity', 'fixtures');
    formData.append('file', file);
    formData.append('mode', 'validate');

    const req = new Request('http://localhost/api/admin/imports', {
      method: 'POST',
      body: formData,
    });

    const res = await importsRoute.POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.totalRows).toBe(2);
    expect(data.validCount).toBe(1);
    expect(data.errorCount).toBe(1);

    const preview = data.preview;
    expect(preview[0].valid).toBe(true);
    expect(preview[1].valid).toBe(false);
    expect(preview[1].errors[0]).toContain('jouer contre lui-même');
  });

  it('POST importe les résultats et résout les buteurs avec warnings si joueur introuvable', async () => {
    const orgId = new mongoose.Types.ObjectId(mockSession.user.organizationId);

    const season = await Saison.create({
      organizationId: orgId,
      nom: 'Saison 1',
      anneeDebut: 2024,
      anneeFin: 2025,
      dateDebut: new Date('2024-09-01'),
      dateFin: new Date('2025-05-31'),
      active: true,
    });

    const comp = await Competition.create({
      organizationId: orgId,
      nom: 'Ligue 1',
      code: 'L1',
      type: 'Championnat',
      niveau: 'National',
      saisonId: season._id,
      dateDebut: season.dateDebut,
      dateFin: season.dateFin,
      clubsParticipants: [],
    });

    const clubHome = await Club.create({
      organizationId: orgId,
      nom: 'Espérance',
      code: 'EST',
      stade: 'Rades',
      ville: 'Tunis',
      fondation: 1919,
      emailOfficiel: 'est@est.tn',
    });

    const clubAway = await Club.create({
      organizationId: orgId,
      nom: 'Club Africain',
      code: 'CA',
      stade: 'El Menzah',
      ville: 'Tunis',
      fondation: 1920,
      emailOfficiel: 'ca@ca.tn',
    });

    const playerHome = await Joueur.create({
      organizationId: orgId,
      nom: 'Mskani',
      prenom: 'Youssef',
      licence: 'LIC-100',
      clubId: clubHome._id,
      position: 'Attaquant',
      nationalite: 'Tunisienne',
      dateNaissance: new Date('1990-10-28'),
      status: 'ACTIVE',
    });

    const match = await Match.create({
      organizationId: orgId,
      saisonId: season._id,
      competitionId: comp._id,
      journee: 1,
      homeClubId: clubHome._id,
      awayClubId: clubAway._id,
      date: new Date('2025-08-15T16:00:00.000Z'),
      stade: 'Rades',
      statut: 'Programmé',
      scoreHome: 0,
      scoreAway: 0,
      isOfficial: true,
      homologue: false,
    });

    const csvContent = [
      'competitionCode,journee,homeClubCode,awayClubCode,scoreHome,scoreAway,statut,homeGoalscorers,awayGoalscorers',
      'L1,1,EST,CA,2,0,Terminé,"Youssef Mskani(10),Inconnu(45)",'
    ].join('\n');

    const file = new File([csvContent], 'results.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('entity', 'results');
    formData.append('file', file);
    formData.append('mode', 'validate');

    const req = new Request('http://localhost/api/admin/imports', {
      method: 'POST',
      body: formData,
    });

    const res = await importsRoute.POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.preview[0].valid).toBe(true);
    expect(data.preview[0].warnings.length).toBe(1);
    expect(data.preview[0].warnings[0]).toContain('Buteur "Inconnu" introuvable');

    const processFormData = new FormData();
    processFormData.append('entity', 'results');
    processFormData.append('file', file);
    processFormData.append('mode', 'process');
    processFormData.append('allow', 'true');

    const processReq = new Request('http://localhost/api/admin/imports', {
      method: 'POST',
      body: processFormData,
    });

    const processRes = await importsRoute.POST(processReq);
    expect(processRes.status).toBe(200);

    const updatedMatch = await Match.findById(match._id);
    expect(updatedMatch!.scoreHome).toBe(2);
    expect(updatedMatch!.statut).toBe('Terminé');
    expect(updatedMatch!.evenements.length).toBe(2);
    
    expect(updatedMatch!.evenements[0].joueurId!.toString()).toBe(playerHome._id.toString());
    expect(updatedMatch!.evenements[0].description).toBe('Youssef Mskani');

    expect(updatedMatch!.evenements[1].joueurId).toBeUndefined();
    expect(updatedMatch!.evenements[1].description).toBe('Inconnu');
  });
});
