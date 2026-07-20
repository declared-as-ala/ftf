import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import connectDB from '../../lib/db';
import Match from '../../lib/models/Match';
import MatchEvent from '../../lib/models/MatchEvent';
import DisciplinaryCard from '../../lib/models/DisciplinaryCard';

const SYSTEM_ACTOR = new mongoose.Types.ObjectId('000000000000000000000001');
const LEGACY_PREFIX = 'legacy:';
const typeMap = {
  But: 'GOAL',
  'Carton Jaune': 'YELLOW',
  'Carton Rouge': 'DIRECT_RED',
  'Carton Jaune Rouge': 'SECOND_YELLOW_RED',
} as const;

const cardTypes = new Set(['YELLOW', 'DIRECT_RED', 'SECOND_YELLOW_RED']);

async function rollback() {
  const result = await MatchEvent.deleteMany({ clientMutationId: { $regex: `^${LEGACY_PREFIX}` } });
  console.log(`Migration 010 rollback: ${result.deletedCount} canonical backfill events removed; embedded legacy events were never changed.`);
}

async function migrate({ dryRun }: { dryRun: boolean }) {
  let eligible = 0;
  let inserted = 0;
  let existing = 0;
  let skipped = 0;
  let linkedCards = 0;
  const parityFailures: string[] = [];

  for await (const match of Match.find({ 'evenements.0': { $exists: true } }).cursor()) {
    const expectedIds: string[] = [];
    for (let index = 0; index < match.evenements.length; index += 1) {
      const event = match.evenements[index] as any;
      const type = typeMap[event.type as keyof typeof typeMap];
      if (!type || !event.joueurId || !event.equipe) {
        skipped += 1;
        continue;
      }

      eligible += 1;
      const clientMutationId = `${LEGACY_PREFIX}${match._id}:${event._id || index}`;
      expectedIds.push(clientMutationId);
      if (dryRun) continue;

      const canonical = await MatchEvent.findOneAndUpdate(
        { organizationId: match.organizationId, matchId: match._id, clientMutationId },
        {
          $setOnInsert: {
            organizationId: match.organizationId,
            matchId: match._id,
            competitionId: match.competitionId,
            saisonId: match.saisonId,
            roundId: match.roundId,
            clubId: event.equipe === 'home' ? match.homeClubId : match.awayClubId,
            playerId: event.joueurId,
            type,
            minute: event.minute ?? 0,
            notes: event.description,
            status: match.homologue ? 'CONFIRMED' : 'DRAFT',
            clientMutationId,
            createdBy: match.validePar || SYSTEM_ACTOR,
          },
        },
        { upsert: true, new: true, includeResultMetadata: true }
      );

      const eventDocument = canonical.value;
      if (!eventDocument) throw new Error(`Unable to materialize ${clientMutationId}`);
      if (canonical.lastErrorObject?.updatedExisting) existing += 1;
      else inserted += 1;

      if (cardTypes.has(type)) {
        const linked = await DisciplinaryCard.findOneAndUpdate(
          {
            organizationId: match.organizationId,
            matchId: match._id,
            joueurId: event.joueurId,
            cardType: type,
            minute: event.minute ?? 0,
            $or: [{ sourceEventId: { $exists: false } }, { sourceEventId: null }],
          },
          { $set: { sourceEventId: eventDocument._id } },
          { sort: { createdAt: 1 } }
        );
        if (linked) linkedCards += 1;
      }
    }

    if (!dryRun && expectedIds.length > 0) {
      const actual = await MatchEvent.countDocuments({
        organizationId: match.organizationId,
        matchId: match._id,
        clientMutationId: { $in: expectedIds },
      });
      if (actual !== expectedIds.length) parityFailures.push(`${match._id}: expected ${expectedIds.length}, found ${actual}`);
    }
  }

  if (parityFailures.length > 0) {
    throw new Error(`Migration parity gate failed:\n${parityFailures.slice(0, 20).join('\n')}`);
  }

  console.log(
    dryRun
      ? `Migration 010 dry-run: ${eligible} eligible events, ${skipped} unsupported legacy events preserved.`
      : `Migration 010 complete: ${inserted} inserted, ${existing} already present, ${linkedCards} cards source-linked, ${skipped} unsupported legacy events preserved. Per-match parity gate passed.`
  );
}

async function main() {
  await connectDB();
  if (process.argv.includes('--rollback')) await rollback();
  else await migrate({ dryRun: process.argv.includes('--dry-run') });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
