import mongoose, { Schema, Document, Model } from 'mongoose';

export type RoundStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface IRound extends Document {
  organizationId: mongoose.Types.ObjectId;
  competitionId: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  number: number;
  name: string;
  dateDebut: Date;
  dateFin: Date;
  status: RoundStatus;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoundSchema = new Schema<IRound>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    competitionId: {
      type: Schema.Types.ObjectId,
      ref: 'Competition',
      required: true,
    },
    saisonId: {
      type: Schema.Types.ObjectId,
      ref: 'Saison',
      required: true,
    },
    number: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dateDebut: {
      type: Date,
      required: true,
    },
    dateFin: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT',
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: a competition cannot have duplicate round numbers
RoundSchema.index({ competitionId: 1, number: 1 }, { unique: true });
// Fast query indexes
RoundSchema.index({ organizationId: 1 });
RoundSchema.index({ saisonId: 1 });

const Round: Model<IRound> = mongoose.models.Round || mongoose.model<IRound>('Round', RoundSchema);

export default Round;
