/**
 * Migration 004 — Mise à jour du statut des matchs
 *   - Remplace 'À Valider' → 'Brouillon' (pour les matchs non-homologués avec score saisi)
 *   - Ajoute isOfficial = true par défaut
 *   - Ajoute processingVersion = 0 par défaut
 *
 * Idempotente : peut être relancée en toute sécurité.
 * Exécution : npx tsx scripts/migrations/004-match-status.ts
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
  const db = mongoose.connection;

  console.log('🏁 Démarrage de la migration 004-match-status...');

  // 1. Ajouter isOfficial = true là où le champ est absent
  const officialResult = await db.collection('matches').updateMany(
    { isOfficial: { $exists: false } },
    { $set: { isOfficial: true } }
  );
  console.log(`   isOfficial ajouté : ${officialResult.modifiedCount} matchs`);

  // 2. Ajouter processingVersion = 0 là où le champ est absent
  const versionResult = await db.collection('matches').updateMany(
    { processingVersion: { $exists: false } },
    { $set: { processingVersion: 0 } }
  );
  console.log(`   processingVersion ajouté : ${versionResult.modifiedCount} matchs`);

  // 3. Convertir 'À Valider' → 'Brouillon' (matchs avec score saisi mais non homologués)
  const statusResult = await db.collection('matches').updateMany(
    { statut: 'À Valider' },
    { $set: { statut: 'Brouillon' } }
  );
  console.log(`   'À Valider' → 'Brouillon' : ${statusResult.modifiedCount} matchs`);

  // 4. Initialiser forfeitCause = null là où le champ est absent
  await db.collection('matches').updateMany(
    { forfeitCause: { $exists: false } },
    { $set: { forfeitCause: null } }
  );

  console.log('✅ Migration 004-match-status terminée avec succès !');

  await mongoose.connection.close();
  console.log('🔌 Déconnexion de MongoDB');
}

migrate().catch((error) => {
  console.error('❌ Erreur lors de la migration 004-match-status :', error);
  process.exit(1);
});
