/**
 * Migration 003 — Création des Journées (Rounds)
 *   - Crée les objets Round (Journée) à partir des Matchs existants.
 *   - Associe chaque match à son Round correspondant via roundId.
 *
 * Idempotente : peut être relancée en toute sécurité.
 * Exécution : npx tsx scripts/migrations/003-rounds.ts
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
import Round from '../../lib/models/Round';
import Competition from '../../lib/models/Competition';
import Organization from '../../lib/models/Organization';

async function migrate() {
  await connectDB();
  const db = mongoose.connection;

  console.log('🏁 Démarrage de la migration 003-rounds...');

  // 1. Récupérer l'organisation FTF par défaut
  const org = await Organization.findOne({ code: 'FTF' });
  if (!org) {
    console.error('❌ Organisation FTF introuvable. Veuillez exécuter la migration 002 d\'abord.');
    process.exit(1);
  }
  const orgId = org._id;

  // 2. Récupérer tous les matchs
  const matches = await db.collection('matches').find({}).toArray();
  console.log(`   Nombre de matchs trouvés : ${matches.length}`);

  let createdRounds = 0;
  let updatedMatches = 0;

  // Grouper les matchs par competitionId et journee
  for (const match of matches) {
    if (!match.competitionId || match.journee === undefined) {
      console.warn(`⚠️ Match ${match._id} ignoré (competitionId ou journee manquant)`);
      continue;
    }

    const compIdStr = match.competitionId.toString();
    const roundNumber = Number(match.journee);

    // Chercher la compétition pour récupérer la saisonId et les dates
    const competition = await Competition.findById(match.competitionId);
    if (!competition) {
      console.warn(`⚠️ Compétition ${compIdStr} introuvable pour le match ${match._id}`);
      continue;
    }

    // Chercher si le Round existe déjà
    let round = await Round.findOne({
      competitionId: match.competitionId,
      number: roundNumber,
    });

    if (!round) {
      // Créer le Round
      round = await Round.create({
        organizationId: orgId,
        competitionId: match.competitionId,
        saisonId: competition.saisonId,
        number: roundNumber,
        name: `Journée ${roundNumber}`,
        dateDebut: competition.dateDebut || new Date(),
        dateFin: competition.dateFin || new Date(),
        status: 'ACTIVE',
        active: true,
      });
      createdRounds++;
    }

    // Mettre à jour le match
    if (!match.roundId || match.roundId.toString() !== round._id.toString()) {
      await db.collection('matches').updateOne(
        { _id: match._id },
        { $set: { roundId: round._id } }
      );
      updatedMatches++;
    }
  }

  console.log(`✅ Migration 003-rounds terminée avec succès !`);
  console.log(`   Rounds créés : ${createdRounds}`);
  console.log(`   Matchs mis à jour avec roundId : ${updatedMatches}`);

  await mongoose.connection.close();
  console.log('🔌 Déconnexion de MongoDB');
}

migrate().catch((error) => {
  console.error('❌ Erreur lors de la migration 003-rounds :', error);
  process.exit(1);
});
