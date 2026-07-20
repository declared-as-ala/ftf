import { NextResponse } from 'next/server';
import { ApiError, apiError, requireAdmin } from '@/lib/api';
import MatchWorkspaceService from '@/lib/services/match-workspace.service';
import { matchResultPatchSchema } from '@/lib/validators/match';

export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireAdmin(); const data = await MatchWorkspaceService.getMatch((await params).id, session.user.organizationId!); return NextResponse.json(data); }
  catch (error) { if ((error as Error).message === 'MATCH_NOT_FOUND') return apiError(new ApiError(404, 'Match introuvable'), 'GET match'); return apiError(error, 'GET /api/admin/matches/[id]'); }
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireAdmin(); const input = matchResultPatchSchema.parse(await req.json()); const data = await MatchWorkspaceService.updateMatch((await params).id, session.user.organizationId!, session.user.id, input); return NextResponse.json(data); }
  catch (error) { const code = (error as Error).message; if (code === 'MATCH_OFFICIAL' || code === 'STALE_MATCH_VERSION') return apiError(new ApiError(409, code === 'MATCH_OFFICIAL' ? 'Match officiel — réouverture obligatoire' : 'Le match a été modifié dans une autre session'), 'PUT match'); return apiError(error, 'PUT /api/admin/matches/[id]'); }
}
