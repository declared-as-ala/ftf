import { NextResponse } from 'next/server';
import { apiError, requireAdmin } from '@/lib/api';
import AuditLog from '@/lib/models/AuditLog';
import MatchEvent from '@/lib/models/MatchEvent';
export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireAdmin(); const id = (await params).id; const eventIds = await MatchEvent.find({ organizationId: session.user.organizationId, matchId: id }).distinct('_id'); const logs = await AuditLog.find({ organizationId: session.user.organizationId, $or: [{ entityType: 'Match', entityId: id }, { entityType: 'MatchEvent', entityId: { $in: eventIds } }] }).sort({ createdAt: -1 }).limit(300).lean(); return NextResponse.json({ logs }); } catch (error) { return apiError(error, 'GET match audit'); } }
