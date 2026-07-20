import mongoose, { Schema, Document, Model } from 'mongoose';

export type ArbitreCategorie = 
  | 'Élite'
  | 'Première Division'
  | 'Deuxième Division'
  | 'Régional'
  | 'ELITE'
  | 'NATIONAL'
  | 'REGIONAL';

export interface IArbitre extends Document {
  organizationId?: mongoose.Types.ObjectId;
  nom: string;
  prenom: string;
  categorie: ArbitreCategorie;
  dateNaissance: Date;
  nationalite: string;
  photo?: string;
  email?: string;
  telephone?: string;
  ville: string;
  certifications: {
    type: string;
    dateObtention: Date;
    dateExpiration?: Date;
  }[];
  disponibilites: {
    date: Date;
    disponible: boolean;
  }[];
  matchesArbitres: mongoose.Types.ObjectId[];
  evaluations: {
    matchId: mongoose.Types.ObjectId;
    note: number;
    commentaire?: string;
    evaluateur: string;
    date: Date;
  }[];
  suspensions: mongoose.Types.ObjectId[];
  statistiques: {
    matchesArbitres: number;
    cartonsJaunes: number;
    cartonsRouges: number;
    notesMoyenne: number;
  };
  actif: boolean;
  status: 'ACTIVE' | 'UNAVAILABLE' | 'SUSPENDED' | 'INACTIVE' | 'ARCHIVED';
  displayName?: string;
  licence?: string;
  region?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ArbitreSchema = new Schema<IArbitre>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'UNAVAILABLE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
    },
    displayName: {
      type: String,
      trim: true,
    },
    licence: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
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
    categorie: {
      type: String,
      enum: ['Élite', 'Première Division', 'Deuxième Division', 'Régional', 'ELITE', 'NATIONAL', 'REGIONAL'],
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
      default: '/placeholder-arbitre.png',
    },
    email: String,
    telephone: String,
    ville: {
      type: String,
      required: true,
    },
    certifications: [{
      type: {
        type: String,
        required: true,
      },
      dateObtention: {
        type: Date,
        required: true,
      },
      dateExpiration: Date,
    }],
    disponibilites: [{
      date: Date,
      disponible: Boolean,
    }],
    matchesArbitres: [{
      type: Schema.Types.ObjectId,
      ref: 'Match',
    }],
    evaluations: [{
      matchId: {
        type: Schema.Types.ObjectId,
        ref: 'Match',
      },
      note: Number,
      commentaire: String,
      evaluateur: String,
      date: { type: Date, default: Date.now },
    }],
    suspensions: [{
      type: Schema.Types.ObjectId,
      ref: 'Discipline',
    }],
    statistiques: {
      matchesArbitres: { type: Number, default: 0 },
      cartonsJaunes: { type: Number, default: 0 },
      cartonsRouges: { type: Number, default: 0 },
      notesMoyenne: { type: Number, default: 0 },
    },
    actif: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ArbitreSchema.pre('save', function (next) {
  if (this.prenom && this.nom) {
    this.displayName = `${this.prenom} ${this.nom}`.trim();
  }
  next();
});

const Arbitre: Model<IArbitre> = mongoose.models.Arbitre || mongoose.model<IArbitre>('Arbitre', ArbitreSchema);

export default Arbitre;

