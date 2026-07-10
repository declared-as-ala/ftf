import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'FTF_ADMIN' | 'CLUB_ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'DISABLED';

export interface IUser extends Document {
  organizationId?: mongoose.Types.ObjectId;
  email: string;
  password: string; // hash bcrypt — jamais exposé (select: false)
  name?: string;
  role: UserRole;
  clubId?: mongoose.Types.ObjectId;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      // Les anciennes valeurs 'ADMIN'/'CLUB' sont converties par
      // scripts/migrations/001-roles.ts et normalisées à la connexion.
      enum: ['FTF_ADMIN', 'CLUB_ADMIN'],
      required: true,
      default: 'CLUB_ADMIN',
    },
    clubId: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      // Un administrateur de club doit être rattaché à un club.
      required: function (this: IUser) {
        return this.role === 'CLUB_ADMIN';
      },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'INVITED', 'DISABLED'],
      default: 'ACTIVE',
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: Date,
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
