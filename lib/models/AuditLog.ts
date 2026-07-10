import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Journal d'audit IMMUABLE : insertion uniquement — jamais de mise à jour
 * ni de suppression (aucune API ne doit exposer update/delete sur ce modèle).
 * `organizationId` devient obligatoire avec la migration organisation (Phase 2).
 */
export interface IAuditLog extends Document {
  organizationId?: mongoose.Types.ObjectId;
  actorUserId: mongoose.Types.ObjectId;
  actorRole: 'FTF_ADMIN' | 'CLUB_ADMIN';
  action: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      enum: ['FTF_ADMIN', 'CLUB_ADMIN'],
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    reason: String,
    ipAddress: String,
    userAgent: String,
    requestId: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ actorUserId: 1, createdAt: -1 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
