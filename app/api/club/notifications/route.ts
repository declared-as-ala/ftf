import { NextResponse } from 'next/server';
import { requireClub, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Notification from '@/lib/models/Notification';
import NotificationService from '@/lib/services/notification.service';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { clubId, session } = await requireClub();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const notifs = await NotificationService.getForClub(
      clubId,
      session.user.organizationId!,
      unreadOnly
    );

    const unreadCount = await Notification.countDocuments({
      recipientClubId: clubId,
      read: false,
    });

    return NextResponse.json({ notifications: notifs, unreadCount });
  } catch (error) {
    return apiError(error, 'GET /api/club/notifications');
  }
}

export async function PUT(req: Request) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const body = await req.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId requis' }, { status: 400 });
    }

    await NotificationService.markRead(notificationId, clubId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, 'PUT /api/club/notifications');
  }
}
