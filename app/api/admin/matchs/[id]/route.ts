import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
// Enregistrent les modèles référencés par les populate()
import '@/lib/models/Joueur';
import '@/lib/models/Club';
import '@/lib/models/Competition';
import '@/lib/models/Saison';
import '@/lib/models/Arbitre';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import { matchResultPatchSchema } from '@/lib/validators/match';
import AuditService from '@/lib/services/audit.service';

export const runtime = 'nodejs';

type ParamsPromise = { params: Promise<{ id: string }> } | { params: { id: string } };

function unwrapIdParam(context: ParamsPromise): Promise<string> {
  const maybePromise = (context as any).params;
  if (typeof maybePromise.then === 'function') {
    return (maybePromise as Promise<{ id: string }>).then((p) => p.id);
  }
  return Promise.resolve((maybePromise as { id: string }).id);
}

export async function GET(_req: Request, context: ParamsPromise) {
  try {
    await requireAdmin();
    await connectDB();

    const id = await unwrapIdParam(context);

    const match = await Match.findById(id)
      .populate('homeClubId', 'nom logo')
      .populate('awayClubId', 'nom logo')
      .populate('competitionId', 'nom')
      .populate('saisonId', 'nom')
      .populate('arbitrePrincipalId', 'nom prenom')
      .populate('evenements.joueurId', 'nom prenom numeroMaillot clubId')
      .lean();

    if (!match) {
      throw new ApiError(404, 'Match introuvable');
    }

    // Recalculer le score à partir des buts assignés
    const goals = (match.evenements || []).filter((ev: any) => ev.type === 'But' && ev.equipe);
    match.scoreHome = goals.filter((ev: any) => ev.equipe === 'home').length;
    match.scoreAway = goals.filter((ev: any) => ev.equipe === 'away').length;

    return NextResponse.json(match);
  } catch (error) {
    return apiError(error, 'GET /api/admin/matchs/[id]');
  }
}

export async function PUT(req: Request, context: ParamsPromise) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const id = await unwrapIdParam(context);

    const existing = await Match.findById(id).select('homologue scoreHome scoreAway statut');
    if (!existing) {
      throw new ApiError(404, 'Match introuvable');
    }
    if (existing.homologue) {
      throw new ApiError(409, 'Match homologué — modification interdite sans réouverture officielle');
    }

    const data = matchResultPatchSchema.parse(await req.json());

    const updateData: Record<string, unknown> = {};
    if (data.scoreHome !== undefined) updateData.scoreHome = data.scoreHome;
    if (data.scoreAway !== undefined) updateData.scoreAway = data.scoreAway;
    if (data.statut) updateData.statut = data.statut;

    const match = await Match.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('homeClubId', 'nom logo')
      .populate('awayClubId', 'nom logo')
      .populate('competitionId', 'nom')
      .populate('saisonId', 'nom')
      .populate('arbitrePrincipalId', 'nom prenom')
      .populate('evenements.joueurId', 'nom prenom numeroMaillot clubId')
      .lean();

    if (!match) {
      throw new ApiError(404, 'Match introuvable');
    }

    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'MATCH_RESULT_UPDATED',
      entityType: 'Match',
      entityId: id,
      before: {
        scoreHome: existing.scoreHome,
        scoreAway: existing.scoreAway,
        statut: existing.statut,
      },
      after: updateData,
    });

    return NextResponse.json(match);
  } catch (error) {
    return apiError(error, 'PUT /api/admin/matchs/[id]');
  }
}
