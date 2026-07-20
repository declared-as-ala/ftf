import mongoose, { Schema, Document, Model } from 'mongoose';

// Extended status enum per spec §5.3 + roadmap Sprint 4.1
export type MatchStatut = 
  | 'Programmé'    // Scheduled, not yet played
  | 'En Cours'     // In progress (live)
  | 'Brouillon'    // Draft result entered, not finalized
  | 'À Valider'    // Awaiting validation (legacy alias)
  | 'Terminé'      // Finalized / homologué
  | 'Reporté'      // Postponed
  | 'Annulé'       // Cancelled
  | 'Abandonné'    // Abandoned mid-match
  | 'Forfait'      // Forfeit awarded
  | 'Replay Ordonné'; // Ordered to be replayed

export type ForfeitCause = 'HOME' | 'AWAY' | 'BOTH' | null;

export interface IEvenementMatch {
  type: 'But' | 'Carton Jaune' | 'Carton Rouge' | 'Carton Jaune Rouge' | 'Remplacement' | 'Autre';
  minute: number;
  joueurId?: mongoose.Types.ObjectId;
  equipe?: 'home' | 'away';
  description?: string;
}

export interface IMatch extends Document {
  organizationId: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  competitionId: mongoose.Types.ObjectId;
  roundId?: mongoose.Types.ObjectId;
  journee: number;
  homeClubId: mongoose.Types.ObjectId;
  awayClubId: mongoose.Types.ObjectId;
  date: Date;
  stade: string;
  venueCity?: string;
  // Scores
  scoreHome: number;
  scoreAway: number;
  // Status & lifecycle
  statut: MatchStatut;
  isOfficial: boolean;
  // Finalization fields (Sprint 4.2)
  homologue: boolean;
  validePar?: mongoose.Types.ObjectId;
  dateValidation?: Date;
  processingVersion: number;        // Monotonically incremented to prevent concurrent finalization
  scoreOverride?: {
    reasonCode: 'FORFEIT' | 'ADMINISTRATIVE_DECISION' | 'LEGACY_IMPORT' | 'FEDERATION_CORRECTION';
    explanation: string;
    authorizedBy: mongoose.Types.ObjectId;
    authorizedAt: Date;
  };
  reopenReason?: string;
  reopenedBy?: mongoose.Types.ObjectId;
  reopenedAt?: Date;
  // Forfeit fields
  forfeitCause?: ForfeitCause;
  forfeitScore?: { home: number; away: number };
  // Staff & events
  arbitrePrincipalId?: mongoose.Types.ObjectId;
  assistants?: mongoose.Types.ObjectId[];
  evenements: IEvenementMatch[];
  feuilleMatchElectronique?: {
    homeComposition: mongoose.Types.ObjectId[];
    awayComposition: mongoose.Types.ObjectId[];
    homeRemplacants: mongoose.Types.ObjectId[];
    awayRemplacants: mongoose.Types.ObjectId[];
    homeStaff: mongoose.Types.ObjectId[];
    awayStaff: mongoose.Types.ObjectId[];
  };
  // Metadata
  notes?: string;
  rapportArbitre?: string;
  spectateurs?: number;
  public?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    saisonId: {
      type: Schema.Types.ObjectId,
      ref: 'Saison',
      required: true,
    },
    competitionId: {
      type: Schema.Types.ObjectId,
      ref: 'Competition',
      required: true,
    },
    roundId: {
      type: Schema.Types.ObjectId,
      ref: 'Round',
      required: false,
    },
    journee: {
      type: Number,
      required: true,
    },
    homeClubId: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    awayClubId: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    stade: {
      type: String,
      required: true,
    },
    venueCity: { type: String, trim: true, maxlength: 120 },
    scoreHome: {
      type: Number,
      default: 0,
    },
    scoreAway: {
      type: Number,
      default: 0,
    },
    statut: {
      type: String,
      enum: ['Programmé', 'En Cours', 'Brouillon', 'À Valider', 'Terminé', 'Reporté', 'Annulé', 'Abandonné', 'Forfait', 'Replay Ordonné'],
      default: 'Programmé',
    },
    isOfficial: {
      type: Boolean,
      default: true,
    },
    homologue: {
      type: Boolean,
      default: false,
    },
    validePar: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dateValidation: Date,
    processingVersion: {
      type: Number,
      default: 0,
    },
    scoreOverride: {
      reasonCode: {
        type: String,
        enum: ['FORFEIT', 'ADMINISTRATIVE_DECISION', 'LEGACY_IMPORT', 'FEDERATION_CORRECTION'],
      },
      explanation: { type: String, trim: true, maxlength: 1000 },
      authorizedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      authorizedAt: Date,
    },
    reopenReason: String,
    reopenedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reopenedAt: Date,
    forfeitCause: {
      type: String,
      enum: ['HOME', 'AWAY', 'BOTH', null],
      default: null,
    },
    forfeitScore: {
      home: { type: Number },
      away: { type: Number },
    },
    arbitrePrincipalId: {
      type: Schema.Types.ObjectId,
      ref: 'Arbitre',
    },
    assistants: [{
      type: Schema.Types.ObjectId,
      ref: 'Arbitre',
    }],
    evenements: [{
      type: {
        type: String,
        enum: ['But', 'Carton Jaune', 'Carton Rouge', 'Carton Jaune Rouge', 'Remplacement', 'Autre'],
      },
      minute: Number,
      joueurId: {
        type: Schema.Types.ObjectId,
        ref: 'Joueur',
      },
      equipe: {
        type: String,
        enum: ['home', 'away'],
        required: false,
      },
      description: String,
    }],
    feuilleMatchElectronique: {
      homeComposition: [{
        type: Schema.Types.ObjectId,
        ref: 'Joueur',
      }],
      awayComposition: [{
        type: Schema.Types.ObjectId,
        ref: 'Joueur',
      }],
      homeRemplacants: [{
        type: Schema.Types.ObjectId,
        ref: 'Joueur',
      }],
      awayRemplacants: [{
        type: Schema.Types.ObjectId,
        ref: 'Joueur',
      }],
      homeStaff: [{
        type: Schema.Types.ObjectId,
        ref: 'Staff',
      }],
      awayStaff: [{
        type: Schema.Types.ObjectId,
        ref: 'Staff',
      }],
    },
    notes: String,
    rapportArbitre: String,
    spectateurs: Number,
    public: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Query indexes
MatchSchema.index({ competitionId: 1, journee: 1 });
MatchSchema.index({ roundId: 1 });
MatchSchema.index({ organizationId: 1, statut: 1 });
MatchSchema.index({ homeClubId: 1 });
MatchSchema.index({ awayClubId: 1 });

const Match: Model<IMatch> = mongoose.models.Match || mongoose.model<IMatch>('Match', MatchSchema);

export default Match;
