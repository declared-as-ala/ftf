import mongoose, { Schema, Document, Model } from 'mongoose';

export type DisciplineType = 
  | 'Carton Jaune'
  | 'Carton Rouge'
  | 'Suspension Manuelle'
  | 'Sanction Club'
  | 'Huis Clos'
  | 'Amende'
  | 'Points Retirés'
  | 'Interdiction Supporters';

export type DisciplineCible = 'Joueur' | 'Staff' | 'Club';

export type DisciplineStatut = 
  | 'En Attente'
  | 'Validée'
  | 'En Cours'
  | 'Terminée'
  | 'Annulée';

export interface IDiscipline extends Document {
  type: DisciplineType;
  cible: DisciplineCible;
  joueurId?: mongoose.Types.ObjectId;
  staffId?: mongoose.Types.ObjectId;
  clubId: mongoose.Types.ObjectId;
  matchId?: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  raison: string;
  dateIncident: Date;
  matchesSuspendus: number;
  matchesRestants: number;
  dateDebut?: Date;
  dateFin?: Date;
  statut: DisciplineStatut;
  amende?: number;
  pointsRetires?: number;
  validePar?: mongoose.Types.ObjectId;
  dateValidation?: Date;
  notes?: string;
  documentJustificatif?: string;
  historique: {
    action: string;
    utilisateur: string;
    date: Date;
    commentaire?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const DisciplineSchema = new Schema<IDiscipline>(
  {
    type: {
      type: String,
      enum: [
        'Carton Jaune',
        'Carton Rouge',
        'Suspension Manuelle',
        'Sanction Club',
        'Huis Clos',
        'Amende',
        'Points Retirés',
        'Interdiction Supporters',
      ],
      required: true,
    },
    cible: {
      type: String,
      enum: ['Joueur', 'Staff', 'Club'],
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
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
    },
    saisonId: {
      type: Schema.Types.ObjectId,
      ref: 'Saison',
      required: true,
    },
    raison: {
      type: String,
      required: true,
    },
    dateIncident: {
      type: Date,
      required: true,
    },
    matchesSuspendus: {
      type: Number,
      default: 0,
    },
    matchesRestants: {
      type: Number,
      default: 0,
    },
    dateDebut: Date,
    dateFin: Date,
    statut: {
      type: String,
      enum: ['En Attente', 'Validée', 'En Cours', 'Terminée', 'Annulée'],
      default: 'En Attente',
    },
    amende: Number,
    pointsRetires: Number,
    validePar: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dateValidation: Date,
    notes: String,
    documentJustificatif: String,
    historique: [{
      action: String,
      utilisateur: String,
      date: { type: Date, default: Date.now },
      commentaire: String,
    }],
  },
  {
    timestamps: true,
  }
);

const Discipline: Model<IDiscipline> = mongoose.models.Discipline || mongoose.model<IDiscipline>('Discipline', DisciplineSchema);

export default Discipline;

