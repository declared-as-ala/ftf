import Notification from '../models/Notification';
import type { NotificationType } from '../models/Notification';

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

/**
 * NotificationService — idempotent notification creation via dedupeKey.
 * Uses upsert on dedupeKey so calling twice is always safe.
 */
export class NotificationService {
  static async notify(input: NotifyInput) {
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
      { dedupeKey: input.dedupeKey },
      { $setOnInsert: { ...doc, dedupeKey: input.dedupeKey } },
      { upsert: true, new: false }
    );
  }

  static async markRead(notificationId: string, clubId?: string) {
    const filter: Record<string, unknown> = { _id: notificationId, read: false };
    if (clubId) filter.recipientClubId = clubId;
    await Notification.findOneAndUpdate(
      filter,
      { read: true, readAt: new Date() }
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
