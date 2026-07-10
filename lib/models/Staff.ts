import mongoose, { Schema, Document, Model } from 'mongoose';

export type StaffType = 
  | 'Entraîneur Principal'
  | 'Entraîneur Adjoint'
  | 'Préparateur Physique'
  | 'Médecin'
  | 'Kinésithérapeute'
  | 'Analyste Vidéo'
  | 'Recruteur'
  | 'Directeur Sportif';

export type CertificationType = 
  | 'UEFA Pro'
  | 'UEFA A'
  | 'UEFA B'
  | 'CAF A'
  | 'CAF B'
  | 'Licence Médicale'
  | 'Autre';

export interface IStaff extends Document {
  nom: string;
  prenom: string;
  type: StaffType;
  clubId: mongoose.Types.ObjectId;
  dateNaissance: Date;
  nationalite: string;
  photo?: string;
  email?: string;
  telephone?: string;
  certifications: {
    type: CertificationType;
    dateObtention: Date;
    dateExpiration?: Date;
    organisme: string;
  }[];
  suspensions: mongoose.Types.ObjectId[];
  historique: {
    club: string;
    periode: string;
    poste: string;
  }[];
  licenceValide: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StaffSchema = new Schema<IStaff>(
  {
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
    type: {
      type: String,
      enum: [
        'Entraîneur Principal',
        'Entraîneur Adjoint',
        'Préparateur Physique',
        'Médecin',
        'Kinésithérapeute',
        'Analyste Vidéo',
        'Recruteur',
        'Directeur Sportif',
      ],
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
    nationalite: {
      type: String,
      required: true,
    },
    photo: {
      type: String,
      default: '/placeholder-staff.png',
    },
    email: String,
    telephone: String,
    certifications: [{
      type: {
        type: String,
        enum: ['UEFA Pro', 'UEFA A', 'UEFA B', 'CAF A', 'CAF B', 'Licence Médicale', 'Autre'],
      },
      dateObtention: Date,
      dateExpiration: Date,
      organisme: String,
    }],
    suspensions: [{
      type: Schema.Types.ObjectId,
      ref: 'Discipline',
    }],
    historique: [{
      club: String,
      periode: String,
      poste: String,
    }],
    licenceValide: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Staff: Model<IStaff> = mongoose.models.Staff || mongoose.model<IStaff>('Staff', StaffSchema);

export default Staff;

