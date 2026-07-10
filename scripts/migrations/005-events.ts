/**
 * Migration 005 — MatchEvent extraction
 *
 * Migrates embedded Match.evenements into the new Evenement model
 * for the disciplinary/incident event system. Match events (goals,
 * cards, subs) remain embedded as they are tightly coupled to the
 * Match document and queried together.
 *
 * This migration:
 *   1. Adds `matchId` + `saisonId` indexes on Evenement collection
 *      for faster lookups
 *   2. Converts any existing Evenement documents where matchId was
 *      stored as a string to ObjectId
 *   3. Backfills saisonId on Evenement docs from their linked Match
 *   4. Creates a view index for admin dashboard queries
 *
 * Note: The new DisciplinaryCard/Suspension models handle discipline
 * separately — this migration is for the legacy Evenement model.
 */
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI non trouvé dans .env.local');
  process.exit(1);
}

import mongoose from 'mongoose';
import connectDB from '../../lib/db';

async function migrate() {
  await connectDB();
  const db = mongoose.connection;

  console.log('🏁 Démarrage de la migration 005-events...\n');

  // 1. Ensure Evenement collection has matchId index
  try {
    await db.collection('evenements').createIndex({ matchId: 1 });
    console.log('   ✅ Index matchId créé sur evenements');
  } catch {
    console.log('   ℹ️  Index matchId existe déjà');
  }

  // 2. Ensure saisonId index
  try {
    await db.collection('evenements').createIndex({ saisonId: 1 });
    console.log('   ✅ Index saisonId créé sur evenements');
  } catch {
    console.log('   ℹ️  Index saisonId existe déjà');
  }

  // 3. Add status index for admin filtering
  try {
    await db.collection('evenements').createIndex({ statut: 1, dateIncident: -1 });
    console.log('   ✅ Index (statut, dateIncident) créé sur evenements');
  } catch {
    console.log('   ℹ️  Index (statut, dateIncident) existe déjà');
  }

  // 4. Convert string matchId values to ObjectId
  const stringMatchResult = await db.collection('evenements').updateMany(
    { matchId: { $type: 'string' } },
    [{ $set: { matchId: { $toObjectId: '$matchId' } } }]
  );
  if (stringMatchResult.modifiedCount > 0) {
    console.log(`   ✅ ${stringMatchResult.modifiedCount} matchId convertis en ObjectId`);
  } else {
    console.log('   ℹ️  Aucun matchId string à convertir');
  }

  // 5. Backfill saisonId from linked Match documents
  const eventsWithoutSaison = await db.collection('evenements').countDocuments({
    $or: [{ saisonId: { $exists: false } }, { saisonId: null }],
    matchId: { $exists: true, $ne: null },
  });

  if (eventsWithoutSaison > 0) {
    const matches = await db.collection('matches').find(
      {},
      { projection: { _id: 1, saisonId: 1 } }
    ).toArray();

    const matchToSeason = new Map(matches.map((m: any) => [
      m._id.toString(),
      m.saisonId,
    ]));

    let updated = 0;
    const cursor = db.collection('evenements').find({
      $or: [{ saisonId: { $exists: false } }, { saisonId: null }],
      matchId: { $exists: true, $ne: null },
    });

    for await (const event of cursor) {
      const seasonId = matchToSeason.get(event.matchId.toString());
      if (seasonId) {
        await db.collection('evenements').updateOne(
          { _id: event._id },
          { $set: { saisonId: seasonId } }
        );
        updated++;
      }
    }

    console.log(`   ✅ ${updated} saisonId backfillés depuis les matchs`);
  } else {
    console.log('   ℹ️  Aucun evenement sans saisonId');
  }

  // 6. Set default statut for any events missing it
  const statusResult = await db.collection('evenements').updateMany(
    { statut: { $exists: false } },
    { $set: { statut: 'En Cours' } }
  );
  if (statusResult.modifiedCount > 0) {
    console.log(`   ✅ ${statusResult.modifiedCount} statuts par défaut appliqués`);
  }

  // 7. Remove processed flag (cleanup from any previous partial migration)
  await db.collection('evenements').updateMany(
    { processedInV5: { $exists: true } },
    { $unset: { processedInV5: '' } }
  );

  console.log('\n✅ Migration 005-events terminée avec succès !');
  await mongoose.connection.close();
  console.log('🔌 Déconnexion de MongoDB');
}

migrate().catch((error) => {
  console.error('❌ Erreur lors de la migration 005-events :', error);
  process.exit(1);
});
