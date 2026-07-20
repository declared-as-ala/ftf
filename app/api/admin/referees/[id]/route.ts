import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Arbitre from '@/lib/models/Arbitre';
import MatchOfficialAssignment from '@/lib/models/MatchOfficialAssignment';
import '@/lib/models/Match';
import '@/lib/models/Club';
import { refereeUpdateSchema } from '@/lib/validators/referee';
import AuditService from '@/lib/services/audit.service';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) throw new ApiError(400, 'Organisation non configurée');

    await connectDB();

    const { id } = await params;
    const referee = await Arbitre.findOne({
      _id: id,
      organizationId: orgId,
    }).lean();

    if (!referee) {
      throw new ApiError(404, 'Arbitre introuvable');
    }

    // Derived assignment history: every PUBLISHED assignment where this
    // referee holds a role, split into upcoming/previous by match date.
    const assignments = await MatchOfficialAssignment.find({
      organizationId: orgId,
      status: 'PUBLISHED',
      'referees.refereeId': id,
    })
      .populate({
        path: 'matchId',
        select: 'date stade statut homeClubId awayClubId',
        populate: [
          { path: 'homeClubId', select: 'nom logo code' },
          { path: 'awayClubId', select: 'nom logo code' },
        ],
      })
      .sort({ 'matchId.date': -1 })
      .lean();

    const now = new Date();
    const withMatch = assignments.filter((a) => a.matchId);
    const upcoming = withMatch
      .filter((a: any) => new Date(a.matchId.date) >= now)
      .sort((a: any, b: any) => new Date(a.matchId.date).getTime() - new Date(b.matchId.date).getTime());
    const previous = withMatch
      .filter((a: any) => new Date(a.matchId.date) < now)
      .sort((a: any, b: any) => new Date(b.matchId.date).getTime() - new Date(a.matchId.date).getTime());

    const roleOf = (a: any) => a.referees.find((r: any) => r.refereeId.toString() === id)?.role;

    const toEntry = (a: any) => ({
      assignmentId: a._id,
      matchId: a.matchId._id,
      date: a.matchId.date,
      stade: a.matchId.stade,
      statut: a.matchId.statut,
      homeClub: a.matchId.homeClubId,
      awayClub: a.matchId.awayClubId,
      role: roleOf(a),
    });

    return NextResponse.json({
      referee,
      assignments: {
        upcomingCount: upcoming.length,
        previousCount: previous.length,
        totalCount: withMatch.length,
        upcoming: upcoming.slice(0, 10).map(toEntry),
        previous: previous.slice(0, 10).map(toEntry),
      },
    });
  } catch (error) {
    return apiError(error, 'GET /api/admin/referees/[id]');
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) throw new ApiError(400, 'Organisation non configurée');

    await connectDB();

    const { id } = await params;
    const body = await req.json();

    const parsed = refereeUpdateSchema.safeParse({ ...body, id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await Arbitre.findOne({
      _id: id,
      organizationId: orgId,
    });

    if (!existing) {
      throw new ApiError(404, 'Arbitre introuvable');
    }

    // Check unique licence/code if changed
    if (data.licence && data.licence !== existing.licence) {
      const other = await Arbitre.findOne({
        licence: data.licence,
        organizationId: orgId,
        _id: { $ne: id },
      });
      if (other) {
        throw new ApiError(409, `Un autre arbitre avec la licence "${data.licence}" existe déjà`);
      }
    }

    // Map French categories to canonical ones if needed
    let category = data.categorie;
    if (category === 'Élite') category = 'ELITE';
    if (category === 'Première Division' || category === 'Deuxième Division') category = 'NATIONAL';
    if (category === 'Régional') category = 'REGIONAL';

    const before = existing.toObject();

    // Update fields
    existing.nom = data.nom;
    existing.prenom = data.prenom;
    existing.categorie = category as any;
    existing.dateNaissance = data.dateNaissance;
    existing.nationalite = data.nationalite;
    existing.email = data.email || undefined;
    existing.telephone = data.telephone || undefined;
    existing.ville = data.ville;
    existing.status = data.status;
    existing.licence = data.licence || undefined;
    existing.region = data.region || undefined;
    existing.notes = data.notes || undefined;
    existing.actif = data.status === 'ACTIVE';

    await existing.save();

    // Record Audit log
    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'REFEREE_UPDATED',
      entityType: 'Arbitre',
      entityId: existing._id,
      before,
      after: existing.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(existing);
  } catch (error) {
    return apiError(error, 'PUT /api/admin/referees/[id]');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) throw new ApiError(400, 'Organisation non configurée');

    await connectDB();

    const { id } = await params;
    const referee = await Arbitre.findOne({
      _id: id,
      organizationId: orgId,
    });

    if (!referee) {
      throw new ApiError(404, 'Arbitre introuvable');
    }

    const before = referee.toObject();

    // Soft-archive referee
    referee.status = 'ARCHIVED';
    referee.actif = false;
    await referee.save();

    // Record Audit log
    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'REFEREE_ARCHIVED',
      entityType: 'Arbitre',
      entityId: referee._id,
      before,
      after: referee.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, 'DELETE /api/admin/referees/[id]');
  }
}
