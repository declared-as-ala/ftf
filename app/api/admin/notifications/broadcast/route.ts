import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import NotificationBroadcast from '@/lib/models/NotificationBroadcast';
import NotificationService from '@/lib/services/notification.service';
import { NotificationBroadcastSchema } from '@/lib/validators/notification-broadcast';
import '@/lib/models/Club';

export const runtime = 'nodejs';

/** POST /api/admin/notifications/broadcast — compose and fan-out a manual broadcast */
export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    const userId = session.user.id;
    await connectDB();

    const body = await req.json();
    const parsed = NotificationBroadcastSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { subject, body: msgBody, target, targetClubIds, idempotencyKey } = parsed.data;

    const broadcastId = await NotificationService.broadcast({
      organizationId: orgId!,
      createdBy: userId!,
      subject,
      body: msgBody,
      target,
      targetClubIds,
      idempotencyKey,
    });

    const broadcast = await NotificationBroadcast.findById(broadcastId).lean();
    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'Un broadcast identique a déjà été envoyé (Idempotency-Key dupliquée)' },
        { status: 409 }
      );
    }
    return apiError(error, 'POST /api/admin/notifications/broadcast');
  }
}

/** GET /api/admin/notifications/broadcast — paginated broadcast history */
export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    await connectDB();

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const [broadcasts, total] = await Promise.all([
      NotificationBroadcast.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .lean(),
      NotificationBroadcast.countDocuments({ organizationId: orgId }),
    ]);

    return NextResponse.json({ broadcasts, total, page, limit });
  } catch (error) {
    return apiError(error, 'GET /api/admin/notifications/broadcast');
  }
}
