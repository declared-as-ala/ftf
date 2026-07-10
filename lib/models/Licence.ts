import mongoose, { Schema, Document, Model } from 'mongoose';

export type LicenceStatut = 
  | 'En Attente'
  | 'Documents Incomplets'
  | 'En Révision'
  | 'Validée'
  | 'Rejetée'
  | 'Expirée'
  | 'Suspendue';

export type LicenceCible = 'Joueur' | 'Staff';

export interface ILicence extends Document {
  cible: LicenceCible;
  joueurId?: mongoose.Types.ObjectId;
  staffId?: mongoose.Types.ObjectId;
  clubId: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  numeroLicence: string;
  dateEmission: Date;
  dateExpiration: Date;
  statut: LicenceStatut;
  documentsObligatoires: {
    nom: string;
    type: 'Photo' | 'Carte Identité' | 'Certificat Médical' | 'Acte Naissance' | 'Contrat' | 'Autre';
    url?: string;
    fourni: boolean;
    dateUpload?: Date;
  }[];
  signatureElectronique?: {
    joueurStaff?: string;
    club?: string;
    ftf?: string;
  };
  validePar?: mongoose.Types.ObjectId;
  dateValidation?: Date;
  historique: {
    action: string;
    utilisateur: string;
    date: Date;
    commentaire?: string;
  }[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LicenceSchema = new Schema<ILicence>(
  {
    cible: {
      type: String,
      enum: ['Joueur', 'Staff'],
      required: true,
    },
    joueurId: {
      type: Schema.Types.ObjectId,
      ref: 'Joueur',
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
    },
    clubId: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    saisonId: {
      type: Schema.Types.ObjectId,
      ref: 'Saison',
      required: true,
    },
    numeroLicence: {
      type: String,
      required: true,
      unique: true,
    },
    dateEmission: {
      type: Date,
      required: true,
    },
    dateExpiration: {
      type: Date,
      required: true,
    },
    statut: {
      type: String,
      enum: ['En Attente', 'Documents Incomplets', 'En Révision', 'Validée', 'Rejetée', 'Expirée', 'Suspendue'],
      default: 'En Attente',
    },
    documentsObligatoires: [{
      nom: String,
      type: {
        type: String,
        enum: ['Photo', 'Carte Identité', 'Certificat Médical', 'Acte Naissance', 'Contrat', 'Autre'],
      },
      url: String,
      fourni: { type: Boolean, default: false },
      dateUpload: Date,
    }],
    signatureElectronique: {
      joueurStaff: String,
      club: String,
      ftf: String,
    },
    validePar: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dateValidation: Date,
    historique: [{
      action: String,
      utilisateur: String,
      date: { type: Date, default: Date.now },
      commentaire: String,
    }],
    notes: String,
  },
  {
    timestamps: true,
  }
);

const Licence: Model<ILicence> = mongoose.models.Licence || mongoose.model<ILicence>('Licence', LicenceSchema);

export default Licence;

