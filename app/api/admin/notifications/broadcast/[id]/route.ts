import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import NotificationBroadcast from '@/lib/models/NotificationBroadcast';
import Notification from '@/lib/models/Notification';
import AuditService from '@/lib/services/audit.service';

export const runtime = 'nodejs';

/** GET /api/admin/notifications/broadcast/[id] — single broadcast with recipient read stats */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    await connectDB();
    const { id } = await params;

    const broadcast = await NotificationBroadcast.findOne({ _id: id, organizationId: orgId })
      .populate('createdBy', 'name email')
      .populate('targetClubIds', 'nom code logo')
      .lean();

    if (!broadcast) throw new ApiError(404, 'Broadcast introuvable');

    // Fetch per-club delivery status (top 50 recipients)
    const recipients = await Notification.find({
      broadcastId: id,
      organizationId: orgId,
    })
      .select('recipientClubId read readAt createdAt')
      .populate('recipientClubId', 'nom code logo')
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    return NextResponse.json({ broadcast, recipients });
  } catch (error) {
    return apiError(error, 'GET /api/admin/notifications/broadcast/[id]');
  }
}

/** DELETE /api/admin/notifications/broadcast/[id] — soft-archive */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    await connectDB();
    const { id } = await params;

    const broadcast = await NotificationBroadcast.findOne({ _id: id, organizationId: orgId });
    if (!broadcast) throw new ApiError(404, 'Broadcast introuvable');

    const before = { status: broadcast.status };
    broadcast.status = 'ARCHIVED';
    await broadcast.save();

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'NOTIFICATION_BROADCAST_ARCHIVED',
      entityType: 'NotificationBroadcast',
      entityId: broadcast._id,
      before,
      after: { status: 'ARCHIVED' },
      organizationId: orgId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, 'DELETE /api/admin/notifications/broadcast/[id]');
  }
}
