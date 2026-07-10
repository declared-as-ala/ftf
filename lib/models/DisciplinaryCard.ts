import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * DisciplinaryCard — canonical card record (one row per card shown in a match).
 *
 * Rules implemented:
 *   R-001: threshold from DisciplinaryRuleSet.yellowCardThreshold
 *   R-002: isOfficial filter for accumulation
 *   R-003: suspension scope (cross-competition / same-competition)
 *   R-004: CLEARED_AT_SEASON_END — auditable, never deleted
 *   R-006: SECOND_YELLOW_RED absorbed; only DIRECT_RED leaves yellow in accumulation
 */
export type CardType = 'YELLOW' | 'SECOND_YELLOW_RED' | 'DIRECT_RED';
export type CardAccumulationStatus =
  | 'ACTIVE'                  // Counting toward accumulation threshold
  | 'CONSUMED_BY_SUSPENSION'  // Was the card that triggered auto-suspension
  | 'CANCELLED'               // Manually overridden (mandatory reason + audit)
  | 'CLEARED_AT_SEASON_END'   // Cleared by season-end operation (R-004)
  | 'NOT_OFFICIAL';           // Card from a friendly match — never counts (R-002)

export interface IDisciplinaryCard extends Document {
  organizationId: mongoose.Types.ObjectId;
  // Match context
  matchId: mongoose.Types.ObjectId;
  competitionId: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  roundId?: mongoose.Types.ObjectId;
  // Subject
  joueurId: mongoose.Types.ObjectId;
  clubId: mongoose.Types.ObjectId;
  // Card type
  cardType: CardType;
  minute?: number;
  // Accumulation
  accumulationStatus: CardAccumulationStatus;
  accumulationCount?: number;   // Count at the moment this card was recorded (1, 2, 3...)
  linkedSuspensionId?: mongoose.Types.ObjectId;
  // Audit trail
  cancelledReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  clearedBy?: mongoose.Types.ObjectId;
  clearedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DisciplinaryCardSchema = new Schema<IDisciplinaryCard>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    saisonId: { type: Schema.Types.ObjectId, ref: 'Saison', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    joueurId: { type: Schema.Types.ObjectId, ref: 'Joueur', required: true },
    clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    cardType: {
      type: String,
      enum: ['YELLOW', 'SECOND_YELLOW_RED', 'DIRECT_RED'],
      required: true,
    },
    minute: Number,
    accumulationStatus: {
      type: String,
      enum: ['ACTIVE', 'CONSUMED_BY_SUSPENSION', 'CANCELLED', 'CLEARED_AT_SEASON_END', 'NOT_OFFICIAL'],
      default: 'ACTIVE',
    },
    accumulationCount: Number,
    linkedSuspensionId: { type: Schema.Types.ObjectId, ref: 'Suspension' },
    cancelledReason: String,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    clearedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    clearedAt: Date,
    notes: String,
  },
  { timestamps: true }
);

// Query indexes
DisciplinaryCardSchema.index({ joueurId: 1, saisonId: 1, accumulationStatus: 1 });
DisciplinaryCardSchema.index({ matchId: 1 });
DisciplinaryCardSchema.index({ clubId: 1, saisonId: 1 });
DisciplinaryCardSchema.index({ organizationId: 1 });

const DisciplinaryCard: Model<IDisciplinaryCard> =
  mongoose.models.DisciplinaryCard ||
  mongoose.model<IDisciplinaryCard>('DisciplinaryCard', DisciplinaryCardSchema);

export default DisciplinaryCard;
