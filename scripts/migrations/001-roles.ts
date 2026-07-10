/**
 * Migration 001 — Rôles utilisateurs
 *   ADMIN → FTF_ADMIN
 *   CLUB  → CLUB_ADMIN
 * + valeurs par défaut des nouveaux champs User (status, failedLoginAttempts, mustChangePassword).
 *
 * Idempotente : peut être relancée sans effet supplémentaire.
 * Exécution : npx tsx scripts/migrations/001-roles.ts
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI non trouvé dans .env.local');
  process.exit(1);
}

import mongoose from 'mongoose';
import connectDB from '../../lib/db';

async function migrate() {
  await connectDB();
  // Accès direct à la collection : contourne la validation d'enum du schéma
  const users = mongoose.connection.collection('users');

  const adminRes = await users.updateMany({ role: 'ADMIN' }, { $set: { role: 'FTF_ADMIN' } });
  const clubRes = await users.updateMany({ role: 'CLUB' }, { $set: { role: 'CLUB_ADMIN' } });

  const statusRes = await users.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'ACTIVE' } }
  );
  const attemptsRes = await users.updateMany(
    { failedLoginAttempts: { $exists: false } },
    { $set: { failedLoginAttempts: 0 } }
  );
  const mustChangeRes = await users.updateMany(
    { mustChangePassword: { $exists: false } },
    { $set: { mustChangePassword: false } }
  );

  console.log('✅ Migration 001-roles terminée :');
  console.log(`   ADMIN → FTF_ADMIN            : ${adminRes.modifiedCount}`);
  console.log(`   CLUB  → CLUB_ADMIN           : ${clubRes.modifiedCount}`);
  console.log(`   status=ACTIVE ajouté         : ${statusRes.modifiedCount}`);
  console.log(`   failedLoginAttempts=0 ajouté : ${attemptsRes.modifiedCount}`);
  console.log(`   mustChangePassword=false     : ${mustChangeRes.modifiedCount}`);

  const remaining = await users.countDocuments({ role: { $in: ['ADMIN', 'CLUB'] } });
  if (remaining > 0) {
    console.error(`❌ ${remaining} utilisateur(s) avec un ancien rôle restant !`);
    process.exit(1);
  }

  await mongoose.connection.close();
  console.log('🔌 Déconnexion de MongoDB');
}

migrate().catch((error) => {
  console.error('❌ Erreur migration 001-roles :', error);
  process.exit(1);
});
