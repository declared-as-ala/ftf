import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Suspension from '@/lib/models/Suspension';
import SuspensionServiceEntry from '@/lib/models/SuspensionServiceEntry';
import AuditService from '@/lib/services/audit.service';
import '@/lib/models/Joueur';
import '@/lib/models/Club';
import '@/lib/models/Match';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    const { id } = await params;
    await connectDB();

    const suspension = await Suspension.findOne({ _id: id, organizationId: orgId })
      .populate('joueurId', 'nom prenom numeroMaillot photo')
      .populate('clubId', 'nom code logo')
      .populate('sourceMatchId', 'date scoreHome scoreAway statut')
      .lean();

    if (!suspension) {
      return NextResponse.json({ error: 'Suspension introuvable' }, { status: 404 });
    }

    const ledger = await SuspensionServiceEntry.find({ suspensionId: id })
      .populate('matchId', 'date scoreHome scoreAway statut competitionId')
      .sort({ processedAt: -1 })
      .lean();

    return NextResponse.json({ suspension, ledger });
  } catch (error) {
    return apiError(error, 'GET /api/admin/discipline/suspensions/[id]');
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    const { id } = await params;
    await connectDB();

    const body = await req.json();
    const { action, reason, ...updates } = body;

    const suspension = await Suspension.findOne({ _id: id, organizationId: orgId });
    if (!suspension) {
      return NextResponse.json({ error: 'Suspension introuvable' }, { status: 404 });
    }

    const before = {
      status: suspension.status,
      matchesSuspended: suspension.matchesSuspended,
      matchesRemaining: suspension.matchesRemaining,
    };

    if (action === 'cancel') {
      if (!reason || reason.trim().length < 5) {
        return NextResponse.json({ error: 'Une raison (min 5 caractères) est obligatoire' }, { status: 400 });
      }
      if (suspension.status === 'SERVED') {
        return NextResponse.json({ error: 'Impossible d\'annuler une suspension déjà purgée' }, { status: 400 });
      }
      suspension.status = 'CANCELLED';
      suspension.cancelledReason = reason;
      suspension.cancelledBy = session.user.id as any;
      suspension.cancelledAt = new Date();
    } else if (action === 'amend') {
      if (!reason || reason.trim().length < 5) {
        return NextResponse.json({ error: 'Une raison (min 5 caractères) est obligatoire' }, { status: 400 });
      }
      if (updates.matchesSuspended !== undefined) {
        suspension.matchesSuspended = updates.matchesSuspended;
        suspension.matchesRemaining = Math.max(0, updates.matchesSuspended - suspension.matchesServed);
      }
      if (updates.scope) suspension.scope = updates.scope;
      if (updates.notes !== undefined) suspension.notes = updates.notes;
    } else {
      return NextResponse.json({ error: 'Action non reconnue. Utilisez "cancel" ou "amend"' }, { status: 400 });
    }

    await suspension.save();

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: action === 'cancel' ? 'SUSPENSION_CANCELLED' : 'SUSPENSION_AMENDED',
      entityType: 'Suspension',
      entityId: id,
      before,
      after: {
        status: suspension.status,
        matchesSuspended: suspension.matchesSuspended,
        matchesRemaining: suspension.matchesRemaining,
        reason,
      },
      organizationId: orgId,
    });

    return NextResponse.json({ suspension });
  } catch (error) {
    return apiError(error, 'PUT /api/admin/discipline/suspensions/[id]');
  }
}
