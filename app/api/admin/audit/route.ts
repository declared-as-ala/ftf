import { NextResponse } from 'next/server';
import { requireAdmin, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import AuditLog from '@/lib/models/AuditLog';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const actorUserId = searchParams.get('actorUserId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const { skip, limit } = parsePagination(searchParams);

    const query: Record<string, unknown> = {};
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (actorUserId) query.actorUserId = actorUserId;
    if (from || to) {
      query.createdAt = {} as any;
      if (from) (query.createdAt as any).$gte = new Date(from);
      if (to) (query.createdAt as any).$lte = new Date(to);
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AuditLog.countDocuments(query);

    return NextResponse.json({ logs, total });
  } catch (error) {
    return apiError(error, 'GET /api/admin/audit');
  }
}
