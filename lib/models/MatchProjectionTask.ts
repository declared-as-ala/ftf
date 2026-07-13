import mongoose, { Document, Model, Schema } from 'mongoose';

export type MatchProjectionTaskType = 'STANDINGS_REBUILD' | 'ROUND_COMPLETION';
export type MatchProjectionTaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IMatchProjectionTask extends Document {
  organizationId: mongoose.Types.ObjectId;
  matchId: mongoose.Types.ObjectId;
  competitionId: mongoose.Types.ObjectId;
  roundId?: mongoose.Types.ObjectId;
  processingVersion: number;
  type: MatchProjectionTaskType;
  status: MatchProjectionTaskStatus;
  attempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MatchProjectionTaskSchema = new Schema<IMatchProjectionTask>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    processingVersion: { type: Number, required: true, min: 1 },
    type: {
      type: String,
      enum: ['STANDINGS_REBUILD', 'ROUND_COMPLETION'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      required: true,
    },
    attempts: { type: Number, default: 0, required: true },
    lastAttemptAt: Date,
    lastError: String,
    completedAt: Date,
  },
  { timestamps: true }
);

MatchProjectionTaskSchema.index(
  { organizationId: 1, matchId: 1, processingVersion: 1, type: 1 },
  { unique: true }
);
MatchProjectionTaskSchema.index({ organizationId: 1, status: 1, createdAt: 1 });

const MatchProjectionTask: Model<IMatchProjectionTask> =
  mongoose.models.MatchProjectionTask ||
  mongoose.model<IMatchProjectionTask>('MatchProjectionTask', MatchProjectionTaskSchema);

export default MatchProjectionTask;
