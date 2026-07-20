import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Arbitre from '@/lib/models/Arbitre';
import { refereeCreateSchema } from '@/lib/validators/referee';
import AuditService from '@/lib/services/audit.service';

export const runtime = 'nodejs';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) throw new ApiError(400, 'Organisation non configurée');

    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const q = searchParams.get('q')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';

    const filter: Record<string, any> = {
      organizationId: orgId,
    };

    // Par défaut, exclure les archivés sauf si explicitement demandé
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'ARCHIVED' };
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { nom: regex },
        { prenom: regex },
        { displayName: regex },
        { licence: regex },
        { region: regex },
        { ville: regex }
      ];
    }

    const [total, referees] = await Promise.all([
      Arbitre.countDocuments(filter),
      Arbitre.find(filter)
        .sort({ nom: 1, prenom: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    return NextResponse.json({
      referees,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return apiError(error, 'GET /api/admin/referees');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) throw new ApiError(400, 'Organisation non configurée');

    await connectDB();

    const body = await req.json();
    const parsed = refereeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check unique licence/code if provided
    if (data.licence) {
      const existing = await Arbitre.findOne({
        licence: data.licence,
        organizationId: orgId,
      });
      if (existing) {
        throw new ApiError(409, `Un arbitre avec la licence "${data.licence}" existe déjà`);
      }
    }

    // Map French categories to canonical ones if needed
    let category = data.categorie;
    if (category === 'Élite') category = 'ELITE';
    if (category === 'Première Division' || category === 'Deuxième Division') category = 'NATIONAL';
    if (category === 'Régional') category = 'REGIONAL';

    const displayName = `${data.prenom} ${data.nom}`.trim();

    const referee = await Arbitre.create({
      ...data,
      categorie: category,
      organizationId: orgId,
      displayName,
      actif: data.status === 'ACTIVE',
    });

    // Record Audit log
    await AuditService.log({
      actor: { id: session.user.id, role: session.user.role },
      action: 'REFEREE_CREATED',
      entityType: 'Arbitre',
      entityId: referee._id,
      after: referee.toObject(),
      organizationId: orgId,
    });

    return NextResponse.json(referee, { status: 201 });
  } catch (error) {
    return apiError(error, 'POST /api/admin/referees');
  }
}
