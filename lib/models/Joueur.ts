import mongoose, { Schema, Document, Model } from 'mongoose';

export type JoueurStatus = 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'RETIRED' | 'ARCHIVED';

export interface ICarriereHistorique {
  club: string;
  periode: string;
  poste: string;
  matchs?: number;
  buts?: number;
}

export interface IJoueur extends Document {
  organizationId?: mongoose.Types.ObjectId;
  nom: string;
  prenom: string;
  displayName?: string;
  licence: string;
  nationalite: string;
  position: 'Gardien' | 'Défenseur' | 'Milieu' | 'Attaquant';
  clubId: mongoose.Types.ObjectId;
  dateNaissance: Date;
  lieuNaissance?: string;
  photo?: string;
  numeroMaillot?: number;
  taille?: number;
  poids?: number;
  piedPrefere?: 'Gauche' | 'Droit' | 'Les deux';
  category?: string;
  status?: JoueurStatus;
  stats: {
    matchsJoues: number;
    buts: number;
    passes: number;
    cartonsJaunes: number;
    cartonsRouges: number;
  };
  sanctions: mongoose.Types.ObjectId[];
  transferts: mongoose.Types.ObjectId[];
  carriereHistorique: ICarriereHistorique[];
  licenceValide: boolean;
  licenceExpirationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JoueurSchema = new Schema<IJoueur>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
    },
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    licence: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nationalite: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      enum: ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'],
      required: true,
    },
    clubId: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    dateNaissance: {
      type: Date,
      required: true,
    },
    lieuNaissance: String,
    photo: {
      type: String,
      default: '/placeholder-player.png',
    },
    numeroMaillot: Number,
    taille: Number,
    poids: Number,
    piedPrefere: {
      type: String,
      enum: ['Gauche', 'Droit', 'Les deux'],
    },
    category: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'RETIRED', 'ARCHIVED'],
      default: 'ACTIVE',
    },
    stats: {
      matchsJoues: { type: Number, default: 0 },
      buts: { type: Number, default: 0 },
      passes: { type: Number, default: 0 },
      cartonsJaunes: { type: Number, default: 0 },
      cartonsRouges: { type: Number, default: 0 },
    },
    sanctions: [{
      type: Schema.Types.ObjectId,
      ref: 'Discipline',
    }],
    transferts: [{
      type: Schema.Types.ObjectId,
      ref: 'Transfert',
    }],
    carriereHistorique: [{
      club: String,
      periode: String,
      poste: String,
      matchs: Number,
      buts: Number,
    }],
    licenceValide: {
      type: Boolean,
      default: false,
    },
    licenceExpirationDate: Date,
  },
  {
    timestamps: true,
  }
);

const Joueur: Model<IJoueur> = mongoose.models.Joueur || mongoose.model<IJoueur>('Joueur', JoueurSchema);

export default Joueur;
