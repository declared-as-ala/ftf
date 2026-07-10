import { NextResponse } from 'next/server';
import { requireAdmin, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import Saison from '@/lib/models/Saison';
import DisciplinaryRuleSet from '@/lib/models/DisciplinaryRuleSet';
import AuditService from '@/lib/services/audit.service';
import { seasonCreateSchema } from '@/lib/validators/season';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    await connectDB();
    const { skip, limit } = parsePagination(new URL(req.url).searchParams);

    const seasons = await Saison.find({ organizationId: orgId })
      .sort({ dateDebut: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(seasons);
  } catch (error) {
    return apiError(error, 'GET /api/admin/seasons');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    await connectDB();
    const body = await req.json();
    const parsed = seasonCreateSchema.parse(body);

    const code = parsed.nom
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_');

    // Check uniqueness within the same organization
    const existing = await Saison.findOne({ organizationId: orgId, $or: [{ nom: parsed.nom }, { code }] });
    if (existing) {
      return NextResponse.json(
        { error: 'Une saison avec ce nom ou ce code existe déjà' },
        { status: 400 }
      );
    }

    const config = parsed.configuration || {
      seuilCartonsJaunes: 3,
      suspensionCartonRouge: 1,
      suspensionStaff: 1,
    };

    const season = await Saison.create({
      organizationId: orgId,
      nom: parsed.nom,
      code,
      anneeDebut: parsed.anneeDebut,
      anneeFin: parsed.anneeFin,
      dateDebut: parsed.dateDebut,
      dateFin: parsed.dateFin,
      active: false, // Starts inactive until explicitly activated
      status: 'DRAFT',
      configuration: config,
    });

    // Create the default ruleset version 1 for this season
    await DisciplinaryRuleSet.create({
      organizationId: orgId,
      seasonId: season._id,
      name: `Règlement Disciplinaire - ${season.nom}`,
      version: 1,
      yellowCardThreshold: config.seuilCartonsJaunes,
      yellowCardSuspensionMatches: 1,
      yellowCardsCountOnlyOfficialMatches: true,
      clearUnusedYellowCardsAtSeasonEnd: true,
      redCardCreatesProvisionalSuspension: true,
      suspensionScope: 'ALL_OFFICIAL_COMPETITIONS',
      friendlyMatchesCount: false,
      effectiveFrom: season.dateDebut,
      effectiveTo: season.dateFin,
      active: true,
    });

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'SEASON_CREATED',
      entityType: 'Saison',
      entityId: season._id,
      after: season.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    return apiError(error, 'POST /api/admin/seasons');
  }
}
