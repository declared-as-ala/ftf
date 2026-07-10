import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStandingsRow {
  clubId: mongoose.Types.ObjectId;
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string[]; // last 5: 'W'|'D'|'L'
}

export interface IStandings extends Document {
  organizationId: mongoose.Types.ObjectId;
  competitionId: mongoose.Types.ObjectId;
  saisonId: mongoose.Types.ObjectId;
  rows: IStandingsRow[];
  calculatedAt: Date;
  matchesProcessed: number;
}

const StandingsRowSchema = new Schema<IStandingsRow>(
  {
    clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    position: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    drawn: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    goalsFor: { type: Number, default: 0 },
    goalsAgainst: { type: Number, default: 0 },
    goalDifference: { type: Number, default: 0 },
    form: { type: [String], default: [] },
  },
  { _id: false }
);

const StandingsSchema = new Schema<IStandings>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    saisonId: { type: Schema.Types.ObjectId, ref: 'Saison', required: true },
    rows: { type: [StandingsRowSchema], default: [] },
    calculatedAt: { type: Date, default: () => new Date() },
    matchesProcessed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One standings document per competition
StandingsSchema.index({ competitionId: 1 }, { unique: true });
StandingsSchema.index({ organizationId: 1 });

const Standings: Model<IStandings> =
  mongoose.models.Standings || mongoose.model<IStandings>('Standings', StandingsSchema);

export default Standings;
