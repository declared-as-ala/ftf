import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType =
  | 'SUSPENSION_CREATED'
  | 'SUSPENSION_SERVED'
  | 'SUSPENSION_CANCELLED'
  | 'RED_CARD_DECISION_REQUIRED'
  | 'RED_CARD_DECISION_RECORDED'
  | 'YELLOW_AT_RISK'
  | 'ANOMALY_DETECTED'
  | 'STANDINGS_UPDATED'
  | 'MATCH_FINALIZED'
  | 'MATCH_REOPENED'
  | 'REFEREE_ASSIGNMENT_PUBLISHED'
  | 'REFEREE_ASSIGNMENT_UPDATED'
  | 'REFEREE_ASSIGNMENT_CANCELLED'
  | 'MANUAL_BROADCAST';

export interface INotification extends Document {
  organizationId: mongoose.Types.ObjectId;
  recipientClubId?: mongoose.Types.ObjectId;  // null = admin-only notification
  broadcastId?: mongoose.Types.ObjectId;       // parent NotificationBroadcast (manual only)
  type: NotificationType;
  subject: string;
  body: string;
  dedupeKey: string;    // prevents duplicates: e.g. `SUSPENSION_CREATED:${suspensionId}`
  entityType?: string;
  entityId?: mongoose.Types.ObjectId;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    recipientClubId: { type: Schema.Types.ObjectId, ref: 'Club' },
    broadcastId: { type: Schema.Types.ObjectId, ref: 'NotificationBroadcast' },
    type: {
      type: String,
      enum: [
        'SUSPENSION_CREATED',
        'SUSPENSION_SERVED',
        'SUSPENSION_CANCELLED',
        'RED_CARD_DECISION_REQUIRED',
        'RED_CARD_DECISION_RECORDED',
        'YELLOW_AT_RISK',
        'ANOMALY_DETECTED',
        'STANDINGS_UPDATED',
        'MATCH_FINALIZED',
        'MATCH_REOPENED',
        'REFEREE_ASSIGNMENT_PUBLISHED',
        'REFEREE_ASSIGNMENT_UPDATED',
        'REFEREE_ASSIGNMENT_CANCELLED',
        'MANUAL_BROADCAST',
      ],
      required: true,
    },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    dedupeKey: { type: String, required: true },
    entityType: String,
    entityId: { type: Schema.Types.ObjectId },
    read: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Unique on dedupeKey to prevent duplicates (§3 testing: notifications deduped)
NotificationSchema.index({ dedupeKey: 1 }, { unique: true });
NotificationSchema.index({ organizationId: 1, recipientClubId: 1, read: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
