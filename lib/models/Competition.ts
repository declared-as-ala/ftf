import mongoose, { Schema, Document, Model } from 'mongoose';

export type CompetitionType = 
  | 'Championnat'
  | 'Coupe'
  | 'Super Coupe'
  | 'Tournoi';

export type CompetitionNiveau = 
  | 'National'
  | 'Régional'
  | 'International';

export type CompetitionStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type TieBreakerType = 'POINTS' | 'HEAD_TO_HEAD' | 'GOAL_DIFFERENCE' | 'GOALS_SCORED' | 'FAIR_PLAY';

export interface IClassement {
  clubId: mongoose.Types.ObjectId;
  position: number;
  points: number;
  matchesJoues: number;
  victoires: number;
  nuls: number;
  defaites: number;
  butsMarques: number;
  butsEncaisses: number;
  difference: number;
}

export interface ICompetition extends Document {
  organizationId?: mongoose.Types.ObjectId;
  nom: string;
  code?: string;
  type: CompetitionType;
  niveau: CompetitionNiveau;
  saisonId: mongoose.Types.ObjectId;
  logo?: string;
  description?: string;
  dateDebut: Date;
  dateFin: Date;
  clubsParticipants: mongoose.Types.ObjectId[];
  nombreJournees?: number;
  formatCompetition: 'Championnat' | 'Élimination Directe' | 'Groupes + Élimination';
  reglementPoints: {
    victoire: number;
    nul: number;
    defaite: number;
  };
  classement: IClassement[];
  matchs: mongoose.Types.ObjectId[];
  active: boolean;
  status?: CompetitionStatus;
  isOfficial?: boolean;
  tieBreakers?: TieBreakerType[];
  disciplinaryRuleSetId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CompetitionSchema = new Schema<ICompetition>(
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
    type: {
      type: String,
      enum: ['Championnat', 'Coupe', 'Super Coupe', 'Tournoi'],
      required: true,
    },
    niveau: {
      type: String,
      enum: ['National', 'Régional', 'International'],
      required: true,
    },
    saisonId: {
      type: Schema.Types.ObjectId,
      ref: 'Saison',
      required: true,
    },
    logo: String,
    description: String,
    dateDebut: {
      type: Date,
      required: true,
    },
    dateFin: {
      type: Date,
      required: true,
    },
    clubsParticipants: [{
      type: Schema.Types.ObjectId,
      ref: 'Club',
    }],
    nombreJournees: Number,
    formatCompetition: {
      type: String,
      enum: ['Championnat', 'Élimination Directe', 'Groupes + Élimination'],
      default: 'Championnat',
    },
    reglementPoints: {
      victoire: { type: Number, default: 3 },
      nul: { type: Number, default: 1 },
      defaite: { type: Number, default: 0 },
    },
    classement: [{
      clubId: {
        type: Schema.Types.ObjectId,
        ref: 'Club',
      },
      position: Number,
      points: { type: Number, default: 0 },
      matchesJoues: { type: Number, default: 0 },
      victoires: { type: Number, default: 0 },
      nuls: { type: Number, default: 0 },
      defaites: { type: Number, default: 0 },
      butsMarques: { type: Number, default: 0 },
      butsEncaisses: { type: Number, default: 0 },
      difference: { type: Number, default: 0 },
    }],
    matchs: [{
      type: Schema.Types.ObjectId,
      ref: 'Match',
    }],
    active: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT',
    },
    isOfficial: {
      type: Boolean,
      default: true,
    },
    tieBreakers: {
      type: [String],
      enum: ['POINTS', 'HEAD_TO_HEAD', 'GOAL_DIFFERENCE', 'GOALS_SCORED', 'FAIR_PLAY'],
      default: ['POINTS', 'GOAL_DIFFERENCE', 'GOALS_SCORED'],
    },
    disciplinaryRuleSetId: {
      type: Schema.Types.ObjectId,
      ref: 'DisciplinaryRuleSet',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for Stage C multi-tenancy
CompetitionSchema.index({ organizationId: 1, nom: 1 }, { unique: true });
CompetitionSchema.index({ organizationId: 1, code: 1 }, { unique: true });

const Competition: Model<ICompetition> = mongoose.models.Competition || mongoose.model<ICompetition>('Competition', CompetitionSchema);

export default Competition;
