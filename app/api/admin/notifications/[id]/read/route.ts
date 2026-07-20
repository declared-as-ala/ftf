import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Notification from '@/lib/models/Notification';

export const runtime = 'nodejs';

export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    await connectDB();
    const { id } = await params;

    const notif = await Notification.findOne({
      _id: id,
      organizationId: orgId,
      recipientClubId: { $exists: false },
      read: false,
    });
    if (!notif) throw new ApiError(404, 'Notification introuvable');

    notif.read = true;
    notif.readAt = new Date();
    await notif.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, 'PUT /api/admin/notifications/[id]/read');
  }
}
