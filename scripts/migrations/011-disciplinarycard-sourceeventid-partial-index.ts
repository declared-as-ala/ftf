/**
 * Migration 011 — Restore the sparse unique index on
 * DisciplinaryCard.sourceEventId (unique: true, sparse: true).
 *
 * Bug fixed: reopening a match soft-cancels its cards (history preserved,
 * never deleted) but historically left sourceEventId set. Re-finalizing the
 * same canonical event afterwards then failed with E11000 because the plain
 * unique index collided with the card's own cancelled history.
 *
 * Fix: match-correction.service.ts now unsets sourceEventId on cancellation
 * (preserving it as the unindexed previousSourceEventId for traceability).
 * MongoDB partial-index filters don't support $ne, so "unique only among
 * non-cancelled cards" can't be expressed as a partialFilterExpression —
 * unsetting the field is the supported equivalent, and a plain sparse+unique
 * index is therefore correct once that's in place.
 *
 * Idempotent: safe to re-run (Mongoose's syncIndexes only changes what
 * differs from the current schema definition).
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import connectDB from '../../lib/db';
import DisciplinaryCard from '../../lib/models/DisciplinaryCard';

async function main() {
  await connectDB();

  const before = await DisciplinaryCard.collection.indexes();
  console.log('Indexes before:', before.map((i) => i.name));

  const result = await DisciplinaryCard.syncIndexes();
  console.log('syncIndexes result (dropped/rebuilt):', result);

  const after = await DisciplinaryCard.collection.indexes();
  console.log('Indexes after:', after.map((i) => i.name));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
