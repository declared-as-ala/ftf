/**
 * Migration 002 — Organisation & Multi-tenancy (Stages A & B)
 *   - Crée l'organisation par défaut 'Fédération Tunisienne de Football' (code: FTF).
 *   - Associe tous les enregistrements existants à cette organisation.
 *   - Renseigne les nouveaux champs requis ou étendus pour Saison, Competition, Club et Joueur.
 *
 * Idempotente : peut être relancée en toute sécurité.
 * Exécution : npx tsx scripts/migrations/002-organization.ts
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
import Organization from '../../lib/models/Organization';

async function migrate() {
  await connectDB();
  const db = mongoose.connection;

  console.log('🏢 Étape A : Création de l\'organisation par défaut...');
  let org = await Organization.findOne({ code: 'FTF' });
  if (!org) {
    org = await Organization.create({
      name: 'Fédération Tunisienne de Football',
      code: 'FTF',
      type: 'FEDERATION',
      active: true,
    });
    console.log(`✅ Organisation FTF créée avec l'ID: ${org._id}`);
  } else {
    console.log(`ℹ️ Organisation FTF existe déjà avec l'ID: ${org._id}`);
  }

  const orgId = org._id;

  console.log('🔧 Étape B : Association des collections existantes...');

  // 1. Users
  const userRes = await db.collection('users').updateMany(
    { organizationId: { $exists: false } },
    { $set: { organizationId: orgId } }
  );
  console.log(`   users associés : ${userRes.modifiedCount}`);

  // 2. Clubs (avec code, slug, shortName, status)
  const clubs = await db.collection('clubs').find({}).toArray();
  let clubCount = 0;
  for (const club of clubs) {
    const updateFields: any = {};
    if (!club.organizationId) {
      updateFields.organizationId = orgId;
    }
    if (!club.code) {
      // EST, CA, ESS, USM, CSS, ST etc.
      const words = club.nom.split(/\s+/);
      let derivedCode = words.map((w: string) => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '');
      if (derivedCode.length < 2) {
        derivedCode = club.nom.substring(0, 3).toUpperCase();
      }
      updateFields.code = derivedCode;
    }
    if (!club.slug) {
      updateFields.slug = club.nom
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
    }
    if (!club.shortName) {
      updateFields.shortName = club.nom;
    }
    if (!club.status) {
      updateFields.status = 'ACTIVE';
    }

    if (Object.keys(updateFields).length > 0) {
      await db.collection('clubs').updateOne({ _id: club._id }, { $set: updateFields });
      clubCount++;
    }
  }
  console.log(`   clubs mis à jour / associés : ${clubCount}`);

  // 3. Joueurs (avec displayName, category, status)
  const joueurs = await db.collection('joueurs').find({}).toArray();
  let joueurCount = 0;
  for (const joueur of joueurs) {
    const updateFields: any = {};
    if (!joueur.organizationId) {
      updateFields.organizationId = orgId;
    }
    if (!joueur.displayName) {
      updateFields.displayName = `${joueur.prenom} ${joueur.nom}`;
    }
    if (!joueur.category) {
      updateFields.category = 'Sénior';
    }
    if (!joueur.status) {
      updateFields.status = 'ACTIVE';
    }

    if (Object.keys(updateFields).length > 0) {
      await db.collection('joueurs').updateOne({ _id: joueur._id }, { $set: updateFields });
      joueurCount++;
    }
  }
  console.log(`   joueurs mis à jour / associés : ${joueurCount}`);

  // 4. Saisons (avec code, status, isCurrent)
  const saisons = await db.collection('saisons').find({}).toArray();
  let saisonCount = 0;
  for (const saison of saisons) {
    const updateFields: any = {};
    if (!saison.organizationId) {
      updateFields.organizationId = orgId;
    }
    if (!saison.code) {
      updateFields.code = saison.nom
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_');
    }
    if (!saison.status) {
      updateFields.status = saison.active ? 'ACTIVE' : 'ARCHIVED';
    }
    if (saison.isCurrent === undefined) {
      updateFields.isCurrent = !!saison.active;
    }

    if (Object.keys(updateFields).length > 0) {
      await db.collection('saisons').updateOne({ _id: saison._id }, { $set: updateFields });
      saisonCount++;
    }
  }
  console.log(`   saisons mises à jour / associées : ${saisonCount}`);

  // 5. Competitions (avec code, status, isOfficial, tieBreakers)
  const competitions = await db.collection('competitions').find({}).toArray();
  let compCount = 0;
  for (const comp of competitions) {
    const updateFields: any = {};
    if (!comp.organizationId) {
      updateFields.organizationId = orgId;
    }
    if (!comp.code) {
      updateFields.code = comp.nom
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_');
    }
    if (!comp.status) {
      updateFields.status = comp.active ? 'ACTIVE' : 'ARCHIVED';
    }
    if (comp.isOfficial === undefined) {
      updateFields.isOfficial = true;
    }
    if (!comp.tieBreakers) {
      updateFields.tieBreakers = ['POINTS', 'GOAL_DIFFERENCE', 'GOALS_SCORED'];
    }

    if (Object.keys(updateFields).length > 0) {
      await db.collection('competitions').updateOne({ _id: comp._id }, { $set: updateFields });
      compCount++;
    }
  }
  console.log(`   compétitions mises à jour / associées : ${compCount}`);

  // 6. Matchs
  const matchRes = await db.collection('matches').updateMany(
    { organizationId: { $exists: false } },
    { $set: { organizationId: orgId } }
  );
  console.log(`   matchs associés : ${matchRes.modifiedCount}`);

  // 7. AuditLogs
  const auditRes = await db.collection('auditlogs').updateMany(
    { organizationId: { $exists: false } },
    { $set: { organizationId: orgId } }
  );
  console.log(`   audit logs associés : ${auditRes.modifiedCount}`);

  // 8. Arbitres
  const arbitreRes = await db.collection('arbitres').updateMany(
    { organizationId: { $exists: false } },
    { $set: { organizationId: orgId } }
  );
  console.log(`   arbitres associés : ${arbitreRes.modifiedCount}`);

  console.log('✅ Migration 002-organization terminée avec succès !');

  await mongoose.connection.close();
  console.log('🔌 Déconnexion de MongoDB');
}

migrate().catch((error) => {
  console.error('❌ Erreur migration 002-organization :', error);
  process.exit(1);
});
