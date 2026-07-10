import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Suspension — one suspension record per disciplinary event.
 *
 * Rules:
 *   R-001: auto-suspension from yellow accumulation (type YELLOW_ACCUMULATION)
 *   R-005: provisional suspension from red card (type RED_CARD_PROVISIONAL → RED_CARD_FINAL)
 *   R-006: SECOND_YELLOW_RED creates a provisional suspension
 *   R-007: cross-season carryover — sourceSeasonId preserved
 *   R-008: serving engine writes SuspensionServiceEntry per match
 */
export type SuspensionType = 'YELLOW_ACCUMULATION' | 'RED_CARD_PROVISIONAL' | 'RED_CARD_FINAL' | 'MANUAL';
export type SuspensionStatus = 'PROVISIONAL' | 'ACTIVE' | 'SERVED' | 'CANCELLED';
// 'ALL_OFFICIAL_COMPETITIONS' = valeur du DisciplinaryRuleSet ; 'ALL_COMPETITIONS' conservé en compat
export type SuspensionScope =
  | 'ALL_OFFICIAL_COMPETITIONS'
  | 'ALL_COMPETITIONS'
  | 'SAME_COMPETITION'
  | 'SAME_CATEGORY';

export interface ISuspension extends Document {
  organizationId: mongoose.Types.ObjectId;
  // Subject
  joueurId: mongoose.Types.ObjectId;
  clubId: mongoose.Types.ObjectId;
  // Source
  sourceMatchId?: mongoose.Types.ObjectId;       // match that triggered this
  sourceCardId?: mongoose.Types.ObjectId;         // card that triggered this (for provisional)
  sourceSeasonId: mongoose.Types.ObjectId;        // season in which it was created (R-007)
  // Suspension details
  suspensionType: SuspensionType;
  status: SuspensionStatus;
  scope: SuspensionScope;
  competitionId?: mongoose.Types.ObjectId;        // for SAME_COMPETITION scope
  // Duration
  matchesSuspended: number;        // total matches in the decision
  matchesServed: number;           // served so far
  matchesRemaining: number;        // = matchesSuspended - matchesServed
  // Red-card decision fields (populated when type transitions to RED_CARD_FINAL)
  decisionDate?: Date;
  decisionReference?: string;
  decisionReason?: string;
  decisionPdfPath?: string;
  matchesMissedPreDecision?: number;  // already-missed eligible matches to deduct
  // Audit
  createdBy?: string;
  cancelledReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SuspensionSchema = new Schema<ISuspension>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    joueurId: { type: Schema.Types.ObjectId, ref: 'Joueur', required: true },
    clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    sourceMatchId: { type: Schema.Types.ObjectId, ref: 'Match' },
    sourceCardId: { type: Schema.Types.ObjectId, ref: 'DisciplinaryCard' },
    sourceSeasonId: { type: Schema.Types.ObjectId, ref: 'Saison', required: true },
    suspensionType: {
      type: String,
      enum: ['YELLOW_ACCUMULATION', 'RED_CARD_PROVISIONAL', 'RED_CARD_FINAL', 'MANUAL'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PROVISIONAL', 'ACTIVE', 'SERVED', 'CANCELLED'],
      default: 'ACTIVE',
    },
    scope: {
      type: String,
      enum: ['ALL_OFFICIAL_COMPETITIONS', 'ALL_COMPETITIONS', 'SAME_COMPETITION', 'SAME_CATEGORY'],
      default: 'ALL_OFFICIAL_COMPETITIONS',
    },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition' },
    matchesSuspended: { type: Number, required: true, min: 1 },
    matchesServed: { type: Number, default: 0 },
    matchesRemaining: { type: Number, required: true },
    decisionDate: Date,
    decisionReference: String,
    decisionReason: String,
    decisionPdfPath: String,
    matchesMissedPreDecision: { type: Number, default: 0 },
    createdBy: String,
    cancelledReason: String,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    notes: String,
  },
  { timestamps: true }
);

SuspensionSchema.index({ joueurId: 1, status: 1 });
SuspensionSchema.index({ clubId: 1, status: 1 });
SuspensionSchema.index({ organizationId: 1 });

const Suspension: Model<ISuspension> =
  mongoose.models.Suspension ||
  mongoose.model<ISuspension>('Suspension', SuspensionSchema);

export default Suspension;
