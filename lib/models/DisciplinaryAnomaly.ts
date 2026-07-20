import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDisciplinaryAnomaly extends Document {
  organizationId: mongoose.Types.ObjectId;
  matchId: mongoose.Types.ObjectId;
  playerId: mongoose.Types.ObjectId;
  clubId: mongoose.Types.ObjectId;
  sourceEventId?: mongoose.Types.ObjectId;
  type: 'SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT' | 'WRONG_CLUB_EVENT';
  status: 'OPEN' | 'CONFIRMED' | 'DISMISSED' | 'RESOLVED';
  evidence?: string;
  resolutionReason?: string;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
}

const schema = new Schema<IDisciplinaryAnomaly>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'Joueur', required: true },
    clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    sourceEventId: { type: Schema.Types.ObjectId, ref: 'MatchEvent' },
    type: { type: String, enum: ['SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT', 'WRONG_CLUB_EVENT'], required: true },
    status: { type: String, enum: ['OPEN', 'CONFIRMED', 'DISMISSED', 'RESOLVED'], default: 'OPEN' },
    evidence: { type: String, maxlength: 1000 },
    resolutionReason: { type: String, maxlength: 1000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);
schema.index({ organizationId: 1, matchId: 1, status: 1 });
schema.index({ organizationId: 1, sourceEventId: 1, type: 1 }, { unique: true, sparse: true });

const DisciplinaryAnomaly: Model<IDisciplinaryAnomaly> =
  mongoose.models.DisciplinaryAnomaly || mongoose.model<IDisciplinaryAnomaly>('DisciplinaryAnomaly', schema);
export default DisciplinaryAnomaly;
