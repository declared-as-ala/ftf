import { NextResponse } from 'next/server';
import { apiError, requireAdmin } from '@/lib/api';
import MatchDisciplineImpactService from '@/lib/services/match-discipline-impact.service';
export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireAdmin(); return NextResponse.json(await MatchDisciplineImpactService.get((await params).id, session.user.organizationId!)); } catch (error) { return apiError(error, 'GET discipline impact'); } }
