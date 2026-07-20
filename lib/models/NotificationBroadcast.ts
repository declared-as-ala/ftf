import mongoose, { Schema, Document, Model } from 'mongoose';

export type BroadcastTarget = 'ALL' | 'SPECIFIC';
export type BroadcastStatus = 'DRAFT' | 'SENT' | 'ARCHIVED';

export interface INotificationBroadcast extends Document {
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;          // admin user who sent it
  subject: string;
  body: string;
  target: BroadcastTarget;                     // ALL = all active clubs, SPECIFIC = listed clubs
  targetClubIds: mongoose.Types.ObjectId[];    // only used when target = SPECIFIC
  status: BroadcastStatus;
  sentAt?: Date;
  totalRecipients: number;
  readCount: number;                           // denormalized, incremented on club read
  idempotencyKey?: string;                     // client-supplied deduplication
  createdAt: Date;
  updatedAt: Date;
}

const NotificationBroadcastSchema = new Schema<INotificationBroadcast>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    target: { type: String, enum: ['ALL', 'SPECIFIC'], required: true, default: 'ALL' },
    targetClubIds: [{ type: Schema.Types.ObjectId, ref: 'Club' }],
    status: { type: String, enum: ['DRAFT', 'SENT', 'ARCHIVED'], default: 'SENT' },
    sentAt: Date,
    totalRecipients: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    idempotencyKey: { type: String, sparse: true },
  },
  { timestamps: true }
);

// Prevent re-sending the exact same broadcast
NotificationBroadcastSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true }
);
NotificationBroadcastSchema.index({ organizationId: 1, createdAt: -1 });

const NotificationBroadcast: Model<INotificationBroadcast> =
  mongoose.models.NotificationBroadcast ||
  mongoose.model<INotificationBroadcast>('NotificationBroadcast', NotificationBroadcastSchema);

export default NotificationBroadcast;
