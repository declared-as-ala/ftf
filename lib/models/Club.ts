import mongoose, { Schema, Document, Model } from 'mongoose';

export type ClubStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface IClub extends Document {
  organizationId?: mongoose.Types.ObjectId;
  nom: string;
  code?: string;
  slug?: string;
  shortName?: string;
  status?: ClubStatus;
  logo: string;
  stade: string;
  ville: string;
  couleurs: string[];
  fondation: number;
  emailOfficiel: string;
  equipesJeunes: string[];
  equipesFeminines: string[];
  documentsAccreditation: string[];
  description?: string;
  capaciteStade?: number;
  siteweb?: string;
  telephone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClubSchema = new Schema<IClub>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
    },
    nom: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
    },
    shortName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED'],
      default: 'ACTIVE',
    },
    logo: {
      type: String,
      default: '/placeholder-club.png',
    },
    stade: {
      type: String,
      required: true,
    },
    ville: {
      type: String,
      required: true,
    },
    couleurs: {
      type: [String],
      default: [],
    },
    fondation: {
      type: Number,
      required: true,
    },
    emailOfficiel: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    equipesJeunes: {
      type: [String],
      default: [],
    },
    equipesFeminines: {
      type: [String],
      default: [],
    },
    documentsAccreditation: {
      type: [String],
      default: [],
    },
    description: String,
    capaciteStade: Number,
    siteweb: String,
    telephone: String,
  },
  {
    timestamps: true,
  }
);

// Note: Unique compound indexes for organizationId + code / slug will be added in Stage C.

const Club: Model<IClub> = mongoose.models.Club || mongoose.model<IClub>('Club', ClubSchema);

export default Club;
