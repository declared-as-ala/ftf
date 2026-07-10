/**
 * Migration 006 — Règlements Disciplinaires (DisciplinaryRuleSets)
 *   - Crée un document DisciplinaryRuleSet (version 1) pour chaque Saison existante,
 *     en se basant sur le champ Saison.configuration (seuilCartonsJaunes, etc.).
 *   - Associe les compétitions existantes à ce règlement disciplinaire via disciplinaryRuleSetId.
 *
 * Idempotente : peut être relancée en toute sécurité.
 * Exécution : npx tsx scripts/migrations/006-rulesets.ts
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
import DisciplinaryRuleSet from '../../lib/models/DisciplinaryRuleSet';

async function migrate() {
  await connectDB();
  const db = mongoose.connection;

  console.log('⚖️ Création des DisciplinaryRuleSet depuis Saison.configuration...');

  const saisons = await db.collection('saisons').find({}).toArray();
  let createdRulesetsCount = 0;
  let linkedCompetitionsCount = 0;

  for (const saison of saisons) {
    const orgId = saison.organizationId;
    if (!orgId) {
      console.warn(`⚠️ Saison ${saison.nom} n'a pas d'organizationId, migration 002 doit d'abord être lancée !`);
      continue;
    }

    // Récupérer la configuration ou utiliser des valeurs par défaut
    const config = saison.configuration || {};
    const yellowCardThreshold = config.seuilCartonsJaunes !== undefined ? config.seuilCartonsJaunes : 3;

    // Rechercher si un ruleset existe déjà pour cette saison
    let ruleset = await DisciplinaryRuleSet.findOne({
      organizationId: orgId,
      seasonId: saison._id,
      version: 1
    });

    if (!ruleset) {
      ruleset = await DisciplinaryRuleSet.create({
        organizationId: orgId,
        seasonId: saison._id,
        name: `Règlement Disciplinaire - ${saison.nom}`,
        version: 1,
        yellowCardThreshold: yellowCardThreshold,
        yellowCardSuspensionMatches: 1, // baseline 1
        yellowCardsCountOnlyOfficialMatches: true,
        clearUnusedYellowCardsAtSeasonEnd: true,
        redCardCreatesProvisionalSuspension: true,
        suspensionScope: 'ALL_OFFICIAL_COMPETITIONS',
        friendlyMatchesCount: false,
        effectiveFrom: saison.dateDebut,
        effectiveTo: saison.dateFin,
        active: true,
      });
      createdRulesetsCount++;
      console.log(`✅ DisciplinaryRuleSet créé pour ${saison.nom} (ID: ${ruleset._id})`);
    } else {
      console.log(`ℹ️ DisciplinaryRuleSet existe déjà pour ${saison.nom} (ID: ${ruleset._id})`);
    }

    // Mettre à jour les compétitions de cette saison pour pointer vers ce ruleset
    const compRes = await db.collection('competitions').updateMany(
      { saisonId: saison._id, disciplinaryRuleSetId: { $exists: false } },
      { $set: { disciplinaryRuleSetId: ruleset._id } }
    );
    linkedCompetitionsCount += compRes.modifiedCount;
  }

  console.log(`\n📊 Résumé de la migration 006-rulesets :`);
  console.log(`- DisciplinaryRuleSet créés : ${createdRulesetsCount}`);
  console.log(`- Compétitions liées        : ${linkedCompetitionsCount}`);

  await mongoose.connection.close();
  console.log('🔌 Déconnexion de MongoDB');
}

migrate().catch((error) => {
  console.error('❌ Erreur migration 006-rulesets :', error);
  process.exit(1);
});
