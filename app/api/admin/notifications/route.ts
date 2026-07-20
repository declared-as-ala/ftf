import { NextResponse } from 'next/server';
import { requireAdmin, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import Notification from '@/lib/models/Notification';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    await connectDB();

    const url = new URL(req.url);
    const { skip, limit } = parsePagination(url.searchParams, { defaultLimit: 50 });
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const type = url.searchParams.get('type');

    // Admin-only notifications: no recipientClubId (system events)
    const filter: Record<string, unknown> = {
      organizationId: orgId,
      recipientClubId: { $exists: false },
    };
    if (unreadOnly) filter.read = false;
    if (type) filter.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      unreadOnly ? 0 : Notification.countDocuments({ organizationId: orgId, recipientClubId: { $exists: false }, read: false }),
    ]);

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      page: Number(url.searchParams.get('page') || 1),
      limit,
    });
  } catch (error) {
    return apiError(error, 'GET /api/admin/notifications');
  }
}
