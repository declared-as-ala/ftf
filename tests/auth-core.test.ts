import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

let mongod: MongoMemoryServer;

// Importés après le démarrage du serveur mémoire (MONGODB_URI doit être défini avant)
let verifyCredentials: typeof import('../lib/auth-core').verifyCredentials;
let MAX_FAILED_LOGIN_ATTEMPTS: number;
let User: typeof import('../lib/models/User').default;

const PASSWORD = 'Secret@123';
let passwordHash: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ftf-test');

  const authCore = await import('../lib/auth-core');
  verifyCredentials = authCore.verifyCredentials;
  MAX_FAILED_LOGIN_ATTEMPTS = authCore.MAX_FAILED_LOGIN_ATTEMPTS;
  User = (await import('../lib/models/User')).default;

  // Connexion explicite : les modèles sont utilisés avant le premier verifyCredentials
  const { default: connectDB } = await import('../lib/db');
  await connectDB();

  passwordHash = await bcrypt.hash(PASSWORD, 10);
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

beforeEach(async () => {
  // Connexion paresseuse via connectDB au premier appel ; ensuite on nettoie
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.collection('users').deleteMany({});
  }
});

async function createUser(overrides: Record<string, unknown> = {}) {
  return User.create({
    email: 'admin@test.tn',
    password: passwordHash,
    role: 'FTF_ADMIN',
    status: 'ACTIVE',
    ...overrides,
  });
}

describe('verifyCredentials', () => {
  it('accepte des identifiants valides et renvoie le rôle', async () => {
    await createUser();
    const result = await verifyCredentials('admin@test.tn', PASSWORD);
    expect(result).not.toBeNull();
    expect(result!.role).toBe('FTF_ADMIN');
  });

  it("normalise l'email (majuscules)", async () => {
    await createUser();
    const result = await verifyCredentials('ADMIN@TEST.TN', PASSWORD);
    expect(result).not.toBeNull();
  });

  it('rejette un mauvais mot de passe et incrémente le compteur', async () => {
    const user = await createUser();
    const result = await verifyCredentials('admin@test.tn', 'mauvais');
    expect(result).toBeNull();
    const fresh = await User.findById(user._id);
    expect(fresh!.failedLoginAttempts).toBe(1);
  });

  it(`verrouille le compte après ${5} échecs`, async () => {
    const user = await createUser();
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      await verifyCredentials('admin@test.tn', 'mauvais');
    }
    const fresh = await User.findById(user._id);
    expect(fresh!.lockedUntil).toBeInstanceOf(Date);
    expect(fresh!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Même le BON mot de passe est refusé tant que le compte est verrouillé
    const result = await verifyCredentials('admin@test.tn', PASSWORD);
    expect(result).toBeNull();
  });

  it('accepte à nouveau après expiration du verrouillage', async () => {
    const user = await createUser({
      lockedUntil: new Date(Date.now() - 1000), // verrou expiré
      failedLoginAttempts: 0,
    });
    const result = await verifyCredentials('admin@test.tn', PASSWORD);
    expect(result).not.toBeNull();
    const fresh = await User.findById(user._id);
    expect(fresh!.lockedUntil).toBeUndefined();
  });

  it('rejette un compte SUSPENDED même avec le bon mot de passe', async () => {
    await createUser({ status: 'SUSPENDED' });
    expect(await verifyCredentials('admin@test.tn', PASSWORD)).toBeNull();
  });

  it('rejette un compte DISABLED', async () => {
    await createUser({ status: 'DISABLED' });
    expect(await verifyCredentials('admin@test.tn', PASSWORD)).toBeNull();
  });

  it('rejette un utilisateur inexistant', async () => {
    expect(await verifyCredentials('ghost@test.tn', PASSWORD)).toBeNull();
  });

  it('réinitialise le compteur après une connexion réussie', async () => {
    const user = await createUser({ failedLoginAttempts: 3 });
    const result = await verifyCredentials('admin@test.tn', PASSWORD);
    expect(result).not.toBeNull();
    const fresh = await User.findById(user._id);
    expect(fresh!.failedLoginAttempts).toBe(0);
    expect(fresh!.lastLoginAt).toBeInstanceOf(Date);
  });

  it("normalise et auto-répare un rôle legacy 'ADMIN'", async () => {
    // Insertion directe (contourne l'enum du schéma) pour simuler un doc pré-migration
    await mongoose.connection.collection('users').insertOne({
      email: 'legacy@test.tn',
      password: passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
    });
    const result = await verifyCredentials('legacy@test.tn', PASSWORD);
    expect(result).not.toBeNull();
    expect(result!.role).toBe('FTF_ADMIN');

    const healed = await mongoose.connection
      .collection('users')
      .findOne({ email: 'legacy@test.tn' });
    expect(healed!.role).toBe('FTF_ADMIN');
  });
});
