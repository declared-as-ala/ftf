import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDisciplinaryRuleSet extends Document {
  organizationId: mongoose.Types.ObjectId;
  seasonId: mongoose.Types.ObjectId;
  competitionId?: mongoose.Types.ObjectId;
  category?: string;
  name: string;
  version: number;
  yellowCardThreshold: number;
  yellowCardSuspensionMatches: number;
  yellowCardsCountOnlyOfficialMatches: boolean;
  clearUnusedYellowCardsAtSeasonEnd: boolean;
  redCardCreatesProvisionalSuspension: boolean;
  suspensionScope: 'SAME_COMPETITION' | 'SAME_CATEGORY' | 'ALL_OFFICIAL_COMPETITIONS';
  friendlyMatchesCount: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  sourceDocument?: string;
  sourceArticleReferences?: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DisciplinaryRuleSetSchema = new Schema<IDisciplinaryRuleSet>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    seasonId: {
      type: Schema.Types.ObjectId,
      ref: 'Saison',
      required: true,
    },
    competitionId: {
      type: Schema.Types.ObjectId,
      ref: 'Competition',
    },
    category: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    yellowCardThreshold: {
      type: Number,
      required: true,
      default: 3,
    },
    yellowCardSuspensionMatches: {
      type: Number,
      required: true,
      default: 1,
    },
    yellowCardsCountOnlyOfficialMatches: {
      type: Boolean,
      required: true,
      default: true,
    },
    clearUnusedYellowCardsAtSeasonEnd: {
      type: Boolean,
      required: true,
      default: true,
    },
    redCardCreatesProvisionalSuspension: {
      type: Boolean,
      required: true,
      default: true,
    },
    suspensionScope: {
      type: String,
      enum: ['SAME_COMPETITION', 'SAME_CATEGORY', 'ALL_OFFICIAL_COMPETITIONS'],
      required: true,
      default: 'ALL_OFFICIAL_COMPETITIONS',
    },
    friendlyMatchesCount: {
      type: Boolean,
      required: true,
      default: false,
    },
    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    effectiveTo: Date,
    sourceDocument: {
      type: String,
      trim: true,
    },
    sourceArticleReferences: [{
      type: String,
      trim: true,
    }],
    active: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for uniqueness
DisciplinaryRuleSetSchema.index(
  { organizationId: 1, seasonId: 1, competitionId: 1, version: 1 },
  { unique: true, partialFilterExpression: { competitionId: { $exists: true } } }
);

const DisciplinaryRuleSet: Model<IDisciplinaryRuleSet> =
  mongoose.models.DisciplinaryRuleSet || mongoose.model<IDisciplinaryRuleSet>('DisciplinaryRuleSet', DisciplinaryRuleSetSchema);

export default DisciplinaryRuleSet;
