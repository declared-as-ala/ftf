import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog';
import connectDB from '../db';

export interface AuditEntry {
  actor: { id: string; role: 'FTF_ADMIN' | 'CLUB_ADMIN' };
  action: string;
  entityType: string;
  entityId: string | mongoose.Types.ObjectId;
  before?: unknown;
  after?: unknown;
  reason?: string;
  requestId?: string;
  organizationId?: string | mongoose.Types.ObjectId;
}

/**
 * Journal d'audit des mutations sensibles.
 *
 * - `log()` : best-effort (outside transaction) — un échec n'interrompt pas la mutation.
 * - `logWithSession()` : DANS la transaction — garantie de cohérence pour les opérations critiques
 *   (finalisation, réouverture de match, etc.).
 */
export class AuditService {
  static async log(entry: AuditEntry): Promise<void> {
    try {
      await connectDB();
      await AuditLog.create({
        actorUserId: entry.actor.id,
        actorRole: entry.actor.role,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before,
        after: entry.after,
        reason: entry.reason,
        requestId: entry.requestId,
        organizationId: entry.organizationId,
      });
    } catch (error) {
      console.error('AuditService.log failed:', entry.action, error);
    }
  }

  /** Write audit inside an existing Mongoose session (transactional). */
  static async logWithSession(
    entry: AuditEntry,
    session: mongoose.ClientSession
  ): Promise<void> {
    await AuditLog.create(
      [
        {
          actorUserId: entry.actor.id,
          actorRole: entry.actor.role,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: entry.before,
          after: entry.after,
          reason: entry.reason,
          requestId: entry.requestId,
          organizationId: entry.organizationId,
        },
      ],
      { session }
    );
  }
}

export default AuditService;
