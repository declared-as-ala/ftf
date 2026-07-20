import mongoose, { Schema, Document, Model } from 'mongoose';

export type RefereeOfficialRole = 'MAIN' | 'ASSISTANT_1' | 'ASSISTANT_2' | 'FOURTH_OFFICIAL';
export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';

export interface IAssignedReferee {
  refereeId: mongoose.Types.ObjectId;
  role: RefereeOfficialRole;
}

export interface IMatchOfficialAssignment extends Document {
  organizationId: mongoose.Types.ObjectId;
  matchId: mongoose.Types.ObjectId;
  referees: IAssignedReferee[];
  status: AssignmentStatus;
  version: number;
  publishReason?: string;
  cancelReason?: string;
  publishedAt?: Date;
  publishedBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssignedRefereeSchema = new Schema<IAssignedReferee>({
  refereeId: {
    type: Schema.Types.ObjectId,
    ref: 'Arbitre',
    required: true,
  },
  role: {
    type: String,
    enum: ['MAIN', 'ASSISTANT_1', 'ASSISTANT_2', 'FOURTH_OFFICIAL'],
    required: true,
  },
}, { _id: false });

const MatchOfficialAssignmentSchema = new Schema<IMatchOfficialAssignment>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    referees: {
      type: [AssignedRefereeSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
    },
    version: {
      type: Number,
      default: 1,
      required: true,
    },
    publishReason: String,
    cancelReason: String,
    publishedAt: Date,
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
// Compound unique index to guarantee single version document per match and organization
MatchOfficialAssignmentSchema.index({ organizationId: 1, matchId: 1, version: 1 }, { unique: true });
// Queries filtering active/published versions
MatchOfficialAssignmentSchema.index({ matchId: 1, status: 1, version: 1 });
// Helper index for conflict query across referees
MatchOfficialAssignmentSchema.index({ 'referees.refereeId': 1, status: 1 });

const MatchOfficialAssignment: Model<IMatchOfficialAssignment> =
  mongoose.models.MatchOfficialAssignment ||
  mongoose.model<IMatchOfficialAssignment>('MatchOfficialAssignment', MatchOfficialAssignmentSchema);

export default MatchOfficialAssignment;
