import mongoose, { Schema, Document, Model } from 'mongoose';

export type SaisonStatus = 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface ISaison extends Document {
  organizationId?: mongoose.Types.ObjectId;
  nom: string;
  code?: string;
  anneeDebut: number;
  anneeFin: number;
  dateDebut: Date;
  dateFin: Date;
  active: boolean;
  status?: SaisonStatus;
  isCurrent?: boolean;
  competitions: mongoose.Types.ObjectId[];
  clubs: mongoose.Types.ObjectId[];
  configuration: {
    seuilCartonsJaunes: number;
    suspensionCartonRouge: number;
    suspensionStaff: number;
  };
  statistiques?: {
    totalMatchs: number;
    totalButs: number;
    totalCartonsJaunes: number;
    totalCartonsRouges: number;
    totalSuspensions: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SaisonSchema = new Schema<ISaison>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    nom: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      trim: true,
    },
    anneeDebut: {
      type: Number,
      required: true,
    },
    anneeFin: {
      type: Number,
      required: true,
    },
    dateDebut: {
      type: Date,
      required: true,
    },
    dateFin: {
      type: Date,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT',
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    competitions: [{
      type: Schema.Types.ObjectId,
      ref: 'Competition',
    }],
    clubs: [{
      type: Schema.Types.ObjectId,
      ref: 'Club',
    }],
    configuration: {
      seuilCartonsJaunes: { type: Number, default: 3 },
      suspensionCartonRouge: { type: Number, default: 1 },
      suspensionStaff: { type: Number, default: 1 },
    },
    statistiques: {
      totalMatchs: { type: Number, default: 0 },
      totalButs: { type: Number, default: 0 },
      totalCartonsJaunes: { type: Number, default: 0 },
      totalCartonsRouges: { type: Number, default: 0 },
      totalSuspensions: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for Stage C multi-tenancy
SaisonSchema.index({ organizationId: 1, nom: 1 }, { unique: true });
SaisonSchema.index({ organizationId: 1, code: 1 }, { unique: true });
SaisonSchema.index(
  { organizationId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);

const Saison: Model<ISaison> = mongoose.models.Saison || mongoose.model<ISaison>('Saison', SaisonSchema);

export default Saison;
