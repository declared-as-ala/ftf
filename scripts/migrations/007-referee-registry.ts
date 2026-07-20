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
import Arbitre from '../../lib/models/Arbitre';

async function migrate() {
  await connectDB();

  let org = await Organization.findOne({ code: 'FTF' });
  if (!org) {
    org = await Organization.create({
      name: 'Fédération Tunisienne de Football',
      code: 'FTF',
      type: 'FEDERATION',
      active: true,
    });
    console.log(`✅ Organisation FTF créée avec l'ID: ${org._id}`);
  }
  const orgId = org._id;

  const arbitres = await Arbitre.find({});
  let count = 0;

  for (const ref of arbitres) {
    let modified = false;

    if (!ref.organizationId) {
      ref.organizationId = orgId;
      modified = true;
    }

    if (!ref.status) {
      ref.status = ref.actif ? 'ACTIVE' : 'INACTIVE';
      modified = true;
    }

    if (!ref.displayName) {
      ref.displayName = `${ref.prenom} ${ref.nom}`.trim();
      modified = true;
    }

    if (!ref.licence) {
      ref.licence = `REF-${ref._id.toString().substring(18).toUpperCase()}`;
      modified = true;
    }

    if (modified) {
      await ref.save();
      count++;
    }
  }

  console.log(`✅ Migration 007-referee-registry terminée : ${count} arbitre(s) mis à jour.`);
  await mongoose.connection.close();
}

migrate().catch((err) => {
  console.error('❌ Erreur migration 007-referee-registry :', err);
  process.exit(1);
});
