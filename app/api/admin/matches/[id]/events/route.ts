import { NextResponse } from 'next/server';
import { ApiError, apiError, requireAdmin } from '@/lib/api';
import MatchWorkspaceService from '@/lib/services/match-workspace.service';
import MatchEvent from '@/lib/models/MatchEvent';
import { matchEventCreateSchema } from '@/lib/validators/match-event';

export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireAdmin(); const events = await MatchEvent.find({ organizationId: session.user.organizationId, matchId: (await params).id }).populate('clubId', 'nom code logo').populate('playerId', 'nom prenom numeroMaillot clubId').populate('assistPlayerId', 'nom prenom numeroMaillot').sort({ minute: 1, stoppageMinute: 1 }).lean(); return NextResponse.json({ events }); }
  catch (error) { return apiError(error, 'GET /api/admin/matches/[id]/events'); }
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireAdmin(); const input = matchEventCreateSchema.parse(await req.json()); const event = await MatchWorkspaceService.createEvent((await params).id, session.user.organizationId!, session.user.id, input); return NextResponse.json({ event }, { status: 201 }); }
  catch (error) { const code = (error as Error).message; if (code === 'SUSPENDED_PLAYER_CONFIRMATION_REQUIRED') return apiError(new ApiError(409, 'Ce joueur est suspendu. Une confirmation et une note administrative sont obligatoires.'), 'POST event'); if (['MATCH_OFFICIAL','CLUB_NOT_IN_MATCH','CLUB_NOT_IN_COMPETITION','PLAYER_NOT_IN_CLUB','ASSIST_NOT_IN_CLUB'].includes(code)) return apiError(new ApiError(422, code), 'POST event'); return apiError(error, 'POST /api/admin/matches/[id]/events'); }
}
