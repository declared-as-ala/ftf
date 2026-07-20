import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI non trouvé dans .env.local');
  process.exit(1);
}

import mongoose from 'mongoose';
import connectDB from '../../lib/db';
import Match from '../../lib/models/Match';
import MatchOfficialAssignment from '../../lib/models/MatchOfficialAssignment';

async function migrate() {
  await connectDB();

  console.log('Querying matches from database...');
  const matches = await Match.find({
    $or: [
      { arbitrePrincipalId: { $ne: null } },
      { assistants: { $exists: true, $not: { $size: 0 } } }
    ]
  });
  console.log(`Found ${matches.length} matches with legacy official assignments.`);

  console.log('Checking existing version 1 assignments...');
  const existing = await MatchOfficialAssignment.find({ version: 1 }).select('matchId').lean();
  const existingMatchIds = new Set(existing.map(a => a.matchId.toString()));

  const assignmentsToCreate: any[] = [];

  for (const match of matches) {
    if (existingMatchIds.has(match._id.toString())) continue;

    const referees: any[] = [];
    if (match.arbitrePrincipalId) {
      referees.push({
        refereeId: match.arbitrePrincipalId,
        role: 'MAIN',
      });
    }

    if (match.assistants && Array.isArray(match.assistants)) {
      match.assistants.forEach((astId, index) => {
        if (astId) {
          const role = index === 0 ? 'ASSISTANT_1' : 'ASSISTANT_2';
          referees.push({
            refereeId: astId,
            role,
          });
        }
      });
    }

    if (referees.length === 0) continue;

    const isMatchFinalized = match.statut === 'Terminé';

    assignmentsToCreate.push({
      organizationId: match.organizationId,
      matchId: match._id,
      referees,
      status: isMatchFinalized ? 'PUBLISHED' : 'DRAFT',
      version: 1,
      notes: 'Importé de la configuration de match historique',
      publishedAt: isMatchFinalized ? new Date() : undefined,
    });
  }

  let count = 0;
  if (assignmentsToCreate.length > 0) {
    console.log(`Bulk inserting ${assignmentsToCreate.length} assignments...`);
    const res = await MatchOfficialAssignment.insertMany(assignmentsToCreate);
    count = res.length;
  }

  console.log(`✅ Migration 008-match-official-assignments terminée : ${count} désignation(s) de match créée(s).`);
  await mongoose.connection.close();
}

migrate().catch((err) => {
  console.error('❌ Erreur migration 008-match-official-assignments :', err);
  process.exit(1);
});
