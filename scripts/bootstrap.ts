/**
 * Production bootstrap script.
 * Creates the initial FTF admin user and organisation.
 * Safe to run repeatedly (idempotent — skips if org already exists).
 *
 * Usage: npx tsx scripts/bootstrap.ts
 * Requires MONGODB_URI in .env.local and NODE_ENV !== 'production' unless --force passed.
 */
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI non trouvé dans .env.local');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.argv.includes('--force')) {
  console.error('❌ Bootstrap refusé en production sans --force');
  process.exit(1);
}

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../lib/db';
import Organization from '../lib/models/Organization';
import User from '../lib/models/User';
import Saison from '../lib/models/Saison';

async function bootstrap() {
  console.log('🔧 Bootstrap FTF — Création des ressources initiales\n');

  await connectDB();

  // 1. Organisation
  let org = await Organization.findOne({ code: 'FTF' });
  if (!org) {
    org = await Organization.create({
      name: 'Fédération Tunisienne de Football',
      code: 'FTF',
      slug: 'ftf',
      logo: null,
      settings: { timezone: 'Africa/Tunis', locale: 'fr-TN' },
      status: 'ACTIVE',
    });
    console.log('✅ Organisation créée :', org.name);
  } else {
    console.log('ℹ️  Organisation existe déjà :', org.name);
  }

  // 2. FTF admin user — prompt for password or use env var
  let adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!adminPassword) {
    if (!isProduction) {
      adminPassword = 'Admin123!';
      console.warn('⚠️  Mot de passe par défaut utilisé (Admin123!) — changez-le immédiatement en production');
    } else {
      console.error('❌ Définissez BOOTSTRAP_ADMIN_PASSWORD dans .env.local pour le bootstrap en production');
      process.exit(1);
    }
  }

  const existingAdmin = await User.findOne({ email: 'admin@ftf.org.tn' });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(adminPassword, 12);
    await User.create({
      email: 'admin@ftf.org.tn',
      name: 'Admin FTF',
      password: hashed,
      role: 'ADMIN',
      organizationId: org._id,
      status: 'ACTIVE',
      emailVerified: new Date(),
    });
    console.log('✅ Admin FTF créé : admin@ftf.org.tn');
  } else {
    console.log('ℹ️  Admin FTF existe déjà');
  }

  // 3. Current season (optional — can be created later via UI)
  const existingSeason = await Saison.findOne({ organizationId: org._id, isCurrent: true });
  if (!existingSeason) {
    const year = new Date().getFullYear();
    await Saison.create({
      name: `${year}-${year + 1}`,
      startDate: new Date(year, 6, 1),  // 1er juillet
      endDate: new Date(year + 1, 5, 30), // 30 juin
      isCurrent: true,
      organizationId: org._id,
      status: 'ACTIVE',
    });
    console.log(`✅ Saison ${year}-${year + 1} créée comme saison courante`);
  } else {
    console.log('ℹ️  Saison courante existe déjà');
  }

  console.log('\n✅ Bootstrap terminé');
  await mongoose.disconnect();
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap échoué :', err);
  process.exit(1);
});
