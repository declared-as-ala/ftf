import { NextResponse } from 'next/server';
import { requireClub, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import NotificationService from '@/lib/services/notification.service';

export const runtime = 'nodejs';

/** POST /api/club/notifications/read-all — mark every unread notification as read */
export async function POST() {
  try {
    const { clubId, session } = await requireClub();
    const organizationId = session.user.organizationId;
    await connectDB();

    await NotificationService.markAllRead(clubId, organizationId!);

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, 'POST /api/club/notifications/read-all');
  }
}
