import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import Competition from '@/lib/models/Competition';
import Saison from '@/lib/models/Saison';
import Club from '@/lib/models/Club';
import Arbitre from '@/lib/models/Arbitre';
// Enregistre le modèle Joueur pour populate('evenements.joueurId')
import '@/lib/models/Joueur';
import { requireAdmin, apiError, ApiError, parsePagination } from '@/lib/api';
import { matchCreateSchema, matchUpdateSchema } from '@/lib/validators/match';
import AuditService from '@/lib/services/audit.service';

export const runtime = 'nodejs';

/** Vérifie l'existence des références (saison, compétition, clubs, arbitre). */
async function assertMatchReferences(data: {
  saisonId: string;
  competitionId: string;
  homeClubId: string;
  awayClubId: string;
  arbitrePrincipalId?: string;
}) {
  const [saison, competition, homeClub, awayClub] = await Promise.all([
    Saison.findById(data.saisonId),
    Competition.findById(data.competitionId),
    Club.findById(data.homeClubId),
    Club.findById(data.awayClubId),
  ]);

  if (!saison) throw new ApiError(400, 'Saison introuvable');
  if (!competition) throw new ApiError(400, 'Compétition introuvable');
  if (!homeClub || !awayClub) throw new ApiError(400, 'Clubs introuvables');

  if (data.arbitrePrincipalId) {
    const arbitre = await Arbitre.findById(data.arbitrePrincipalId);
    if (!arbitre) throw new ApiError(400, 'Arbitre introuvable');
  }
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await connectDB();

    const url = new URL(req.url);
    const { skip, limit } = parsePagination(url.searchParams);
    const competitionId = url.searchParams.get('competitionId');
    const roundId = url.searchParams.get('roundId');

    const query: any = {};
    if (competitionId) query.competitionId = competitionId;
    if (roundId) query.roundId = roundId;

    const matchs = await Match.find(query)
      .populate('homeClubId', 'nom logo')
      .populate('awayClubId', 'nom logo')
      .populate('competitionId', 'nom')
      .populate('saisonId', 'nom')
      .populate('arbitrePrincipalId', 'nom prenom')
      .populate('evenements.joueurId', 'nom prenom')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(matchs);
  } catch (error) {
    return apiError(error, 'GET /api/admin/matchs');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const data = matchCreateSchema.parse(await req.json());
    await assertMatchReferences(data);

    const match = await Match.create({
      saisonId: data.saisonId,
      competitionId: data.competitionId,
      journee: data.journee,
      homeClubId: data.homeClubId,
      awayClubId: data.awayClubId,
      date: data.date,
      stade: data.stade,
      scoreHome: data.scoreHome,
      scoreAway: data.scoreAway,
      statut: data.statut,
      arbitrePrincipalId: data.arbitrePrincipalId,
      notes: data.notes,
      spectateurs: data.spectateurs,
      public: data.public,
    });

    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'MATCH_CREATED',
      entityType: 'Match',
      entityId: String(match._id),
      after: {
        journee: data.journee,
        homeClubId: data.homeClubId,
        awayClubId: data.awayClubId,
        date: data.date,
        statut: data.statut,
      },
    });

    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    return apiError(error, 'POST /api/admin/matchs');
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const data = matchUpdateSchema.parse(await req.json());

    const existing = await Match.findById(data.id);
    if (!existing) {
      throw new ApiError(404, 'Match introuvable');
    }
    if (existing.homologue) {
      throw new ApiError(409, 'Match homologué — modification interdite sans réouverture officielle');
    }

    await assertMatchReferences(data);

    const before = {
      journee: existing.journee,
      homeClubId: existing.homeClubId,
      awayClubId: existing.awayClubId,
      date: existing.date,
      stade: existing.stade,
      scoreHome: existing.scoreHome,
      scoreAway: existing.scoreAway,
      statut: existing.statut,
    };

    const updated = await Match.findByIdAndUpdate(
      data.id,
      {
        saisonId: data.saisonId,
        competitionId: data.competitionId,
        journee: data.journee,
        homeClubId: data.homeClubId,
        awayClubId: data.awayClubId,
        date: data.date,
        stade: data.stade,
        scoreHome: data.scoreHome,
        scoreAway: data.scoreAway,
        statut: data.statut,
        arbitrePrincipalId: data.arbitrePrincipalId,
        notes: data.notes,
        spectateurs: data.spectateurs,
        ...(typeof data.public === 'boolean' ? { public: data.public } : {}),
      },
      { new: true }
    );

    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'MATCH_UPDATED',
      entityType: 'Match',
      entityId: data.id,
      before,
      after: {
        journee: data.journee,
        homeClubId: data.homeClubId,
        awayClubId: data.awayClubId,
        date: data.date,
        stade: data.stade,
        scoreHome: data.scoreHome,
        scoreAway: data.scoreAway,
        statut: data.statut,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, 'PUT /api/admin/matchs');
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new ApiError(400, 'Missing match id');
    }

    const existing = await Match.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Match introuvable');
    }
    if (existing.homologue) {
      throw new ApiError(409, 'Match homologué — suppression interdite');
    }

    await Match.findByIdAndDelete(id);

    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'MATCH_DELETED',
      entityType: 'Match',
      entityId: id,
      before: {
        journee: existing.journee,
        homeClubId: existing.homeClubId,
        awayClubId: existing.awayClubId,
        date: existing.date,
        statut: existing.statut,
        scoreHome: existing.scoreHome,
        scoreAway: existing.scoreAway,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, 'DELETE /api/admin/matchs');
  }
}
