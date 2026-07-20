import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * SuspensionServiceEntry — ledger: one entry per (suspension, match) pair.
 *
 * R-008: implements the countability evaluation; unique (suspensionId, matchId)
 * prevents double-decrement (§5.8, §6.5).
 */
export type ServingReason =
  | 'OFFICIAL_MATCH_PLAYED'     // Normal serving
  | 'INTERRUPTED_MATCH_COUNTS'  // R-008: interrupted match still counts
  | 'FORFEIT_COUNTS'            // R-008: forfeit counts unless caused by player's own club
  | 'NO_KICKOFF_DOES_NOT_COUNT' // R-008: match that never started
  | 'CLUB_ABSENT_DOES_NOT_COUNT'// R-008: club caused forfeit — own absence
  | 'WRONG_COMPETITION'         // R-008: scope mismatch (SAME_COMPETITION)
  | 'WRONG_CATEGORY'            // R-008: competition category mismatch
  | 'NOT_OFFICIAL'              // R-002: friendly/unofficial match
  | 'ALREADY_COUNTED'           // Duplicate attempt — rejected by unique index path
  | 'MANUAL_CORRECTION';        // Admin override with reason

export interface ISuspensionServiceEntry extends Document {
  organizationId: mongoose.Types.ObjectId;
  suspensionId: mongoose.Types.ObjectId;
  matchId: mongoose.Types.ObjectId;
  joueurId: mongoose.Types.ObjectId;
  clubId: mongoose.Types.ObjectId;
  counted: boolean;
  reason: ServingReason;
  remainingBefore: number;
  remainingAfter: number;
  processedAt: Date;
  processedBy: string;     // 'SYSTEM' or userId
  notes?: string;
  reversedAt?: Date;
  reversedBy?: mongoose.Types.ObjectId;
  reversalReason?: string;
}

const SuspensionServiceEntrySchema = new Schema<ISuspensionServiceEntry>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    suspensionId: { type: Schema.Types.ObjectId, ref: 'Suspension', required: true },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    joueurId: { type: Schema.Types.ObjectId, ref: 'Joueur', required: true },
    clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    counted: { type: Boolean, required: true },
    reason: {
      type: String,
      enum: [
        'OFFICIAL_MATCH_PLAYED',
        'INTERRUPTED_MATCH_COUNTS',
        'FORFEIT_COUNTS',
        'NO_KICKOFF_DOES_NOT_COUNT',
        'CLUB_ABSENT_DOES_NOT_COUNT',
        'WRONG_COMPETITION',
        'WRONG_CATEGORY',
        'NOT_OFFICIAL',
        'ALREADY_COUNTED',
        'MANUAL_CORRECTION',
      ],
      required: true,
    },
    remainingBefore: { type: Number, required: true },
    remainingAfter: { type: Number, required: true },
    processedAt: { type: Date, default: () => new Date() },
    processedBy: { type: String, required: true },
    notes: String,
    reversedAt: Date,
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversalReason: String,
  },
  { timestamps: false }
);

// Core uniqueness constraint — prevents double-decrement (R-008, §5.8)
SuspensionServiceEntrySchema.index({ suspensionId: 1, matchId: 1 }, { unique: true });
SuspensionServiceEntrySchema.index({ suspensionId: 1 });
SuspensionServiceEntrySchema.index({ matchId: 1 });

const SuspensionServiceEntry: Model<ISuspensionServiceEntry> =
  mongoose.models.SuspensionServiceEntry ||
  mongoose.model<ISuspensionServiceEntry>('SuspensionServiceEntry', SuspensionServiceEntrySchema);

export default SuspensionServiceEntry;
