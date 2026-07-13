import mongoose from 'mongoose';
import MatchProjectionTask, {
  type MatchProjectionTaskType,
} from '../models/MatchProjectionTask';
import RoundService from './round.service';
import StandingsService from './standings.service';

interface EnqueueMatchProjectionsInput {
  organizationId: string | mongoose.Types.ObjectId;
  matchId: string | mongoose.Types.ObjectId;
  competitionId: string | mongoose.Types.ObjectId;
  roundId?: string | mongoose.Types.ObjectId;
  processingVersion: number;
}

/** Durable, retryable work for rebuildable projections outside finalization transactions. */
export class MatchProjectionService {
  static async enqueueWithSession(
    input: EnqueueMatchProjectionsInput,
    session: mongoose.ClientSession
  ): Promise<void> {
    const common = {
      organizationId: input.organizationId,
      matchId: input.matchId,
      competitionId: input.competitionId,
      processingVersion: input.processingVersion,
      status: 'PENDING' as const,
      attempts: 0,
    };

    const tasks: Array<typeof common & { type: MatchProjectionTaskType; roundId?: typeof input.roundId }> = [
      { ...common, type: 'STANDINGS_REBUILD' },
    ];
    if (input.roundId) {
      tasks.push({ ...common, type: 'ROUND_COMPLETION', roundId: input.roundId });
    }

    await MatchProjectionTask.create(tasks, { session });
  }

  static async processPendingForMatch(
    matchId: string | mongoose.Types.ObjectId,
    organizationId: string | mongoose.Types.ObjectId,
    actorId?: string
  ): Promise<void> {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const retryable = {
      $or: [
        { status: { $in: ['PENDING', 'FAILED'] } },
        { status: 'PROCESSING', lastAttemptAt: { $lt: staleBefore } },
      ],
    };
    const tasks = await MatchProjectionTask.find({
      matchId,
      organizationId,
      ...retryable,
    }).sort({ createdAt: 1 });

    for (const task of tasks) {
      const claimed = await MatchProjectionTask.findOneAndUpdate(
        { _id: task._id, organizationId, ...retryable },
        {
          $set: { status: 'PROCESSING', lastAttemptAt: new Date() },
          $inc: { attempts: 1 },
          $unset: { lastError: 1 },
        },
        { new: true }
      );
      if (!claimed) continue;

      try {
        if (claimed.type === 'STANDINGS_REBUILD') {
          await StandingsService.rebuildCompetitionStandings(
            claimed.competitionId,
            actorId,
            organizationId
          );
        } else if (claimed.type === 'ROUND_COMPLETION' && claimed.roundId) {
          await RoundService.checkRoundCompletion(claimed.roundId, organizationId);
        }

        await MatchProjectionTask.updateOne(
          { _id: claimed._id, organizationId, status: 'PROCESSING' },
          { $set: { status: 'COMPLETED', completedAt: new Date() } }
        );
      } catch (error) {
        await MatchProjectionTask.updateOne(
          { _id: claimed._id, organizationId, status: 'PROCESSING' },
          {
            $set: {
              status: 'FAILED',
              lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
            },
          }
        );
      }
    }
  }
}

export default MatchProjectionService;
