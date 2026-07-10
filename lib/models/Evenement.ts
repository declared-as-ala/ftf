import mongoose, { Schema, Document, Model } from 'mongoose';

export type EvenementType = 
  | 'Incident'
  | 'Amende'
  | 'Restriction Supporters'
  | 'Huis Clos'
  | 'Suspension Stade'
  | 'Autre';

export type EvenementStatut = 
  | 'En Cours'
  | 'Résolu'
  | 'En Appel'
  | 'Annulé';

export interface IEvenement extends Document {
  type: EvenementType;
  clubId: mongoose.Types.ObjectId;
  matchId?: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  titre: string;
  description: string;
  dateIncident: Date;
  statut: EvenementStatut;
  montantAmende?: number;
  nombreMatchsHuisClos?: number;
  restrictionSupporters?: {
    type: 'Partiel' | 'Total';
    dateDebut: Date;
    dateFin: Date;
  };
  documentsJustificatifs: string[];
  decidePar?: mongoose.Types.ObjectId;
  dateDecision?: Date;
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

const EvenementSchema = new Schema<IEvenement>(
  {
    type: {
      type: String,
      enum: ['Incident', 'Amende', 'Restriction Supporters', 'Huis Clos', 'Suspension Stade', 'Autre'],
      required: true,
    },
    clubId: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
    },
    saisonId: {
      type: Schema.Types.ObjectId,
      ref: 'Saison',
      required: true,
    },
    titre: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    dateIncident: {
      type: Date,
      required: true,
    },
    statut: {
      type: String,
      enum: ['En Cours', 'Résolu', 'En Appel', 'Annulé'],
      default: 'En Cours',
    },
    montantAmende: Number,
    nombreMatchsHuisClos: Number,
    restrictionSupporters: {
      type: {
        type: String,
        enum: ['Partiel', 'Total'],
      },
      dateDebut: Date,
      dateFin: Date,
    },
    documentsJustificatifs: [String],
    decidePar: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dateDecision: Date,
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

const Evenement: Model<IEvenement> = mongoose.models.Evenement || mongoose.model<IEvenement>('Evenement', EvenementSchema);

export default Evenement;

