import Notification from '../models/Notification';
import NotificationBroadcast from '../models/NotificationBroadcast';
import Club from '../models/Club';
import type { NotificationType } from '../models/Notification';
import type mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import AuditService from './audit.service';

export interface NotifyInput {
  organizationId: string;
  recipientClubId?: string;
  type: NotificationType;
  subject: string;
  body: string;
  dedupeKey: string;
  entityType?: string;
  entityId?: string;
}

export interface BroadcastInput {
  organizationId: string;
  createdBy: string;
  subject: string;
  body: string;
  target: 'ALL' | 'SPECIFIC';
  targetClubIds?: string[];
  idempotencyKey?: string;
}

/**
 * NotificationService — idempotent notification creation via dedupeKey.
 * Uses upsert on dedupeKey so calling twice is always safe.
 */
export class NotificationService {
  static async notify(input: NotifyInput, session?: ClientSession) {
    const doc = {
      organizationId: input.organizationId,
      recipientClubId: input.recipientClubId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId ? input.entityId : undefined,
      read: false,
    };

    // findOneAndUpdate with upsert — dedupeKey unique index ensures idempotency
    await Notification.findOneAndUpdate(
      { organizationId: input.organizationId, dedupeKey: input.dedupeKey },
      { $setOnInsert: { ...doc, dedupeKey: input.dedupeKey } },
      { upsert: true, new: false, session }
    );
  }

  /**
   * broadcast() — fan-out a manual notification to all target clubs.
   * Creates a parent NotificationBroadcast document, then bulk-inserts one
   * Notification per recipient club. Idempotency-Key on the parent prevents
   * duplicate broadcasts on client retry.
   */
  static async broadcast(input: BroadcastInput): Promise<string> {
    // Resolve target clubs
    const clubFilter: Record<string, unknown> = {
      organizationId: input.organizationId,
      status: 'ACTIVE',
    };
    if (input.target === 'SPECIFIC' && input.targetClubIds?.length) {
      clubFilter._id = { $in: input.targetClubIds };
    }
    const clubs = await Club.find(clubFilter).select('_id').lean();

    // Create parent broadcast doc
    const broadcast = await NotificationBroadcast.create({
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      subject: input.subject,
      body: input.body,
      target: input.target,
      targetClubIds: input.target === 'SPECIFIC' ? input.targetClubIds : [],
      status: 'SENT',
      sentAt: new Date(),
      totalRecipients: clubs.length,
      readCount: 0,
      idempotencyKey: input.idempotencyKey,
    });

    if (clubs.length > 0) {
      const now = new Date();
      const docs = clubs.map((club: any) => ({
        organizationId: input.organizationId,
        recipientClubId: club._id,
        broadcastId: broadcast._id,
        type: 'MANUAL_BROADCAST' as NotificationType,
        subject: input.subject,
        body: input.body,
        dedupeKey: `BROADCAST:${broadcast._id}:${club._id}`,
        read: false,
        createdAt: now,
      }));

      // ordered:false continues on duplicate key (idempotent retries)
      await Notification.insertMany(docs, { ordered: false }).catch((err: any) => {
        if (err?.code !== 11000) throw err;
      });
    }

    // Audit metadata only — the full message body is not duplicated into the log.
    await AuditService.log({
      actor: { id: input.createdBy, role: 'FTF_ADMIN' },
      action: 'NOTIFICATION_BROADCAST_SENT',
      entityType: 'NotificationBroadcast',
      entityId: broadcast._id,
      after: {
        subject: input.subject,
        target: input.target,
        targetClubCount: input.target === 'SPECIFIC' ? input.targetClubIds?.length ?? 0 : undefined,
        totalRecipients: clubs.length,
      },
      organizationId: input.organizationId,
    });

    return broadcast._id.toString();
  }

  static async markRead(notificationId: string, clubId?: string) {
    const filter: Record<string, unknown> = { _id: notificationId, read: false };
    if (clubId) filter.recipientClubId = clubId;
    const updated = await Notification.findOneAndUpdate(
      filter,
      { read: true, readAt: new Date() },
      { new: true }
    );
    // Increment broadcast readCount if applicable
    if (updated?.broadcastId) {
      await NotificationBroadcast.findByIdAndUpdate(updated.broadcastId, { $inc: { readCount: 1 } });
    }
  }

  /** Mark every unread club notification as read in one bulk write. */
  static async markAllRead(clubId: string, organizationId: string) {
    const unread = await Notification.find({
      organizationId,
      recipientClubId: clubId,
      read: false,
    }).select('_id broadcastId').lean();

    if (unread.length === 0) return;

    await Notification.updateMany(
      { _id: { $in: unread.map((n: any) => n._id) } },
      { $set: { read: true, readAt: new Date() } }
    );

    // Bulk-update broadcast readCounts
    const broadcastCounts: Record<string, number> = {};
    for (const n of unread as any[]) {
      if (n.broadcastId) {
        const key = n.broadcastId.toString();
        broadcastCounts[key] = (broadcastCounts[key] || 0) + 1;
      }
    }
    await Promise.all(
      Object.entries(broadcastCounts).map(([bId, count]) =>
        NotificationBroadcast.findByIdAndUpdate(bId, { $inc: { readCount: count } })
      )
    );
  }

  static async getForClub(clubId: string, organizationId: string, unreadOnly = false) {
    const filter: Record<string, unknown> = { organizationId, recipientClubId: clubId };
    if (unreadOnly) filter.read = false;
    return Notification.find(filter).sort({ createdAt: -1 }).limit(100);
  }

  static async getForAdmin(organizationId: string, unreadOnly = false) {
    const filter: Record<string, unknown> = {
      organizationId,
      recipientClubId: { $exists: false },
    };
    if (unreadOnly) filter.read = false;
    return Notification.find(filter).sort({ createdAt: -1 }).limit(100);
  }
}

export default NotificationService;
