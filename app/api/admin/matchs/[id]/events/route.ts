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
import { eventCreateSchema, eventUpdateSchema } from '@/lib/validators/event';
import AuditService from '@/lib/services/audit.service';

export const runtime = 'nodejs';

// Fonction pour recalculer le score à partir des buts assignés
function recalculateScoreFromGoals(match: any) {
  const goals = match.evenements.filter((ev: any) => ev.type === 'But' && ev.equipe);
  match.scoreHome = goals.filter((ev: any) => ev.equipe === 'home').length;
  match.scoreAway = goals.filter((ev: any) => ev.equipe === 'away').length;
}

type ParamsPromise = { params: Promise<{ id: string }> } | { params: { id: string } };

function unwrapIdParam(context: ParamsPromise): Promise<string> {
  const maybePromise = (context as any).params;
  if (typeof maybePromise.then === 'function') {
    return (maybePromise as Promise<{ id: string }>).then((p) => p.id);
  }
  return Promise.resolve((maybePromise as { id: string }).id);
}

/** Charge le match et refuse toute mutation s'il est homologué. */
async function getMutableMatch(matchId: string) {
  const match = await Match.findById(matchId);
  if (!match) {
    throw new ApiError(404, 'Match introuvable');
  }
  if (match.homologue) {
    throw new ApiError(
      409,
      'Match homologué — les événements ne peuvent plus être modifiés sans réouverture officielle'
    );
  }
  return match;
}

function populatedMatch(matchId: string) {
  return Match.findById(matchId)
    .populate('homeClubId', 'nom logo')
    .populate('awayClubId', 'nom logo')
    .populate('competitionId', 'nom')
    .populate('saisonId', 'nom')
    .populate('arbitrePrincipalId', 'nom prenom')
    .populate('evenements.joueurId', 'nom prenom numeroMaillot clubId')
    .lean();
}

export async function POST(req: Request, context: ParamsPromise) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const matchId = await unwrapIdParam(context);
    const data = eventCreateSchema.parse(await req.json());

    const match = await getMutableMatch(matchId);

    match.evenements.push({
      type: data.type,
      minute: data.minute,
      joueurId: data.joueurId,
      equipe: data.equipe,
      description: data.description,
    } as any);

    // Trier les événements par minute
    match.evenements.sort((a: any, b: any) => a.minute - b.minute);

    // Recalculer le score à partir des buts assignés à une équipe
    recalculateScoreFromGoals(match);

    // Si au moins un but est assigné, mettre le statut à "Terminé"
    const hasAssignedGoals = match.evenements.some(
      (ev: any) => ev.type === 'But' && ev.equipe
    );
    if (hasAssignedGoals && match.statut !== 'Terminé') {
      match.statut = 'Terminé';
    }

    await match.save();

    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'MATCH_EVENT_ADDED',
      entityType: 'Match',
      entityId: matchId,
      after: {
        type: data.type,
        minute: data.minute,
        joueurId: data.joueurId,
        equipe: data.equipe,
      },
    });

    const populated = await populatedMatch(matchId);

    return NextResponse.json(
      {
        evenements: populated?.evenements || [],
        match: populated,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, 'POST /api/admin/matchs/[id]/events');
  }
}

export async function PUT(req: Request, context: ParamsPromise) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const matchId = await unwrapIdParam(context);
    const data = eventUpdateSchema.parse(await req.json());

    const match = await getMutableMatch(matchId);

    const event = match.evenements.find(
      (ev: any) => ev._id.toString() === data.eventId.toString()
    );

    if (!event) {
      throw new ApiError(404, 'Événement introuvable');
    }

    const before = {
      type: event.type,
      minute: event.minute,
      joueurId: (event as any).joueurId,
      equipe: (event as any).equipe,
    };

    // Mettre à jour les champs fournis ('' signifie « désassigner »)
    if (data.equipe !== undefined) {
      (event as any).equipe = data.equipe || undefined;
    }
    if (data.joueurId !== undefined) {
      (event as any).joueurId = data.joueurId || undefined;
    }
    if (data.description !== undefined) {
      (event as any).description = data.description || undefined;
    }

    // Recalculer le score si c'est un but
    if (event.type === 'But') {
      recalculateScoreFromGoals(match);
      // Si au moins un but est assigné, mettre le statut à "Terminé"
      const hasAssignedGoals = match.evenements.some(
        (ev: any) => ev.type === 'But' && ev.equipe
      );
      if (hasAssignedGoals && match.statut !== 'Terminé') {
        match.statut = 'Terminé';
      }
    }

    await match.save();

    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'MATCH_EVENT_UPDATED',
      entityType: 'Match',
      entityId: matchId,
      before,
      after: {
        eventId: data.eventId,
        equipe: data.equipe,
        joueurId: data.joueurId,
      },
    });

    const populated = await populatedMatch(matchId);

    return NextResponse.json({
      evenements: populated?.evenements || [],
      match: populated,
    });
  } catch (error) {
    return apiError(error, 'PUT /api/admin/matchs/[id]/events');
  }
}

export async function DELETE(req: Request, context: ParamsPromise) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const matchId = await unwrapIdParam(context);

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      throw new ApiError(400, 'Missing event id');
    }

    const match = await getMutableMatch(matchId);

    const eventToDelete = match.evenements.find(
      (ev: any) => ev._id.toString() === eventId.toString()
    );

    match.evenements = match.evenements.filter(
      (ev: any) => ev._id.toString() !== eventId.toString()
    ) as any;

    // Recalculer le score à partir des buts restants
    recalculateScoreFromGoals(match);

    await match.save();

    if (eventToDelete) {
      await AuditService.log({
        actor: { id: session.user.id, role: session.user.role },
        action: 'MATCH_EVENT_DELETED',
        entityType: 'Match',
        entityId: matchId,
        before: {
          type: eventToDelete.type,
          minute: eventToDelete.minute,
          joueurId: (eventToDelete as any).joueurId,
          equipe: (eventToDelete as any).equipe,
        },
      });
    }

    const populated = await populatedMatch(matchId);

    return NextResponse.json({
      evenements: populated?.evenements || [],
      match: populated,
    });
  } catch (error) {
    return apiError(error, 'DELETE /api/admin/matchs/[id]/events');
  }
}
