import mongoose, { Schema, Document, Model } from 'mongoose';

export type TransfertStatut = 
  | 'En Attente'
  | 'Validé Club Départ'
  | 'Validé Club Arrivée'
  | 'Validé FTF'
  | 'Complété'
  | 'Rejeté'
  | 'Annulé';

export type TransfertType = 
  | 'Définitif'
  | 'Prêt'
  | 'Libre'
  | 'Fin de Contrat';

export interface ITransfert extends Document {
  joueurId: mongoose.Types.ObjectId;
  clubDepartId: mongoose.Types.ObjectId;
  clubArriveeId: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  type: TransfertType;
  montantIndemnite?: number;
  dateDebut: Date;
  dateFin?: Date;
  statut: TransfertStatut;
  documentsJustificatifs: string[];
  validePar?: {
    clubDepart?: mongoose.Types.ObjectId;
    clubArrivee?: mongoose.Types.ObjectId;
    ftf?: mongoose.Types.ObjectId;
  };
  datesValidation?: {
    clubDepart?: Date;
    clubArrivee?: Date;
    ftf?: Date;
  };
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

const TransfertSchema = new Schema<ITransfert>(
  {
    joueurId: {
      type: Schema.Types.ObjectId,
      ref: 'Joueur',
      required: true,
    },
    clubDepartId: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    clubArriveeId: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    saisonId: {
      type: Schema.Types.ObjectId,
      ref: 'Saison',
      required: true,
    },
    type: {
      type: String,
      enum: ['Définitif', 'Prêt', 'Libre', 'Fin de Contrat'],
      required: true,
    },
    montantIndemnite: Number,
    dateDebut: {
      type: Date,
      required: true,
    },
    dateFin: Date,
    statut: {
      type: String,
      enum: ['En Attente', 'Validé Club Départ', 'Validé Club Arrivée', 'Validé FTF', 'Complété', 'Rejeté', 'Annulé'],
      default: 'En Attente',
    },
    documentsJustificatifs: [String],
    validePar: {
      clubDepart: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      clubArrivee: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      ftf: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    datesValidation: {
      clubDepart: Date,
      clubArrivee: Date,
      ftf: Date,
    },
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

const Transfert: Model<ITransfert> = mongoose.models.Transfert || mongoose.model<ITransfert>('Transfert', TransfertSchema);

export default Transfert;

