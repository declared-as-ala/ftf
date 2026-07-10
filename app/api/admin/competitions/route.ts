import { NextResponse } from 'next/server';
import { requireAdmin, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import Competition from '@/lib/models/Competition';
import Saison from '@/lib/models/Saison';
import DisciplinaryRuleSet from '@/lib/models/DisciplinaryRuleSet';
import AuditService from '@/lib/services/audit.service';
import { competitionCreateSchema } from '@/lib/validators/competition';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organisation non configurée' }, { status: 400 });
    }

    await connectDB();
    const url = new URL(req.url);
    const { skip, limit } = parsePagination(url.searchParams);
    const seasonId = url.searchParams.get('seasonId');

    const query: any = { organizationId: orgId };
    if (seasonId) {
      query.saisonId = seasonId;
    }

    const competitions = await Competition.find(query)
      .populate('saisonId', 'nom code')
      .populate('disciplinaryRuleSetId', 'name version')
      .sort({ dateDebut: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(competitions);
  } catch (error) {
    return apiError(error, 'GET /api/admin/competitions');
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
    const parsed = competitionCreateSchema.parse(body);

    const saison = await Saison.findOne({ _id: parsed.saisonId, organizationId: orgId });
    if (!saison) {
      return NextResponse.json({ error: 'Saison introuvable pour cette organisation' }, { status: 400 });
    }

    const code = parsed.nom
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_');

    // Uniqueness check
    const existing = await Competition.findOne({ organizationId: orgId, $or: [{ nom: parsed.nom }, { code }] });
    if (existing) {
      return NextResponse.json(
        { error: 'Une compétition avec ce nom ou ce code existe déjà' },
        { status: 400 }
      );
    }

    // Auto-link ruleset if not provided
    let ruleSetId = parsed.disciplinaryRuleSetId;
    if (!ruleSetId) {
      const ruleset = await DisciplinaryRuleSet.findOne({
        organizationId: orgId,
        seasonId: parsed.saisonId,
        version: 1,
      });
      if (ruleset) {
        ruleSetId = ruleset._id as any;
      }
    }

    if (ruleSetId) {
      const rulesetExists = await DisciplinaryRuleSet.exists({ _id: ruleSetId, organizationId: orgId });
      if (!rulesetExists) {
        return NextResponse.json({ error: 'Règlement disciplinaire introuvable' }, { status: 400 });
      }
    }

    const competition = await Competition.create({
      organizationId: orgId,
      nom: parsed.nom,
      code,
      type: parsed.type,
      niveau: parsed.niveau,
      saisonId: parsed.saisonId,
      dateDebut: saison.dateDebut,
      dateFin: saison.dateFin,
      clubsParticipants: [],
      formatCompetition: parsed.formatCompetition,
      reglementPoints: parsed.reglementPoints,
      classement: [],
      matchs: [],
      active: true,
      status: 'DRAFT',
      isOfficial: true,
      tieBreakers: ['POINTS', 'GOAL_DIFFERENCE', 'GOALS_SCORED'],
      disciplinaryRuleSetId: ruleSetId,
    });

    // Link competition back to season
    await Saison.updateOne(
      { _id: parsed.saisonId },
      { $push: { competitions: competition._id } }
    );

    await AuditService.log({
      actor: { id: session.user.id, role: 'FTF_ADMIN' },
      action: 'COMPETITION_CREATED',
      entityType: 'Competition',
      entityId: competition._id,
      after: competition.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(competition, { status: 201 });
  } catch (error) {
    return apiError(error, 'POST /api/admin/competitions');
  }
}
