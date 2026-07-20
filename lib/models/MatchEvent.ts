import mongoose, { Document, Model, Schema } from 'mongoose';

export type MatchEventType =
  | 'GOAL'
  | 'OWN_GOAL'
  | 'PENALTY_GOAL'
  | 'YELLOW'
  | 'SECOND_YELLOW_RED'
  | 'DIRECT_RED';
export type MatchEventStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface IMatchEvent extends Document {
  organizationId: mongoose.Types.ObjectId;
  matchId: mongoose.Types.ObjectId;
  competitionId: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  roundId?: mongoose.Types.ObjectId;
  clubId: mongoose.Types.ObjectId;
  playerId: mongoose.Types.ObjectId;
  type: MatchEventType;
  minute: number;
  stoppageMinute?: number;
  assistPlayerId?: mongoose.Types.ObjectId;
  cardReason?: string;
  reportReference?: string;
  notes?: string;
  status: MatchEventStatus;
  clientMutationId: string;
  createdBy: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MatchEventSchema = new Schema<IMatchEvent>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    saisonId: { type: Schema.Types.ObjectId, ref: 'Saison', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'Joueur', required: true },
    type: {
      type: String,
      enum: ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'YELLOW', 'SECOND_YELLOW_RED', 'DIRECT_RED'],
      required: true,
    },
    minute: { type: Number, required: true, min: 0, max: 130 },
    stoppageMinute: { type: Number, min: 0, max: 30 },
    assistPlayerId: { type: Schema.Types.ObjectId, ref: 'Joueur' },
    cardReason: { type: String, trim: true, maxlength: 200 },
    reportReference: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'], default: 'DRAFT' },
    clientMutationId: { type: String, required: true, trim: true, maxlength: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

MatchEventSchema.index({ organizationId: 1, matchId: 1, clientMutationId: 1 }, { unique: true });
MatchEventSchema.index({ organizationId: 1, matchId: 1, status: 1, minute: 1, stoppageMinute: 1 });

const MatchEvent: Model<IMatchEvent> =
  mongoose.models.MatchEvent || mongoose.model<IMatchEvent>('MatchEvent', MatchEventSchema);
export default MatchEvent;
