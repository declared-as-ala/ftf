import { NextResponse } from 'next/server';
import { requireAdmin, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import Suspension from '@/lib/models/Suspension';
import Match from '@/lib/models/Match';
import '@/lib/models/Joueur';
import '@/lib/models/Club';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    await connectDB();

    const url = new URL(req.url);
    const { skip, limit } = parsePagination(url.searchParams, { defaultLimit: 50 });
    const page = Number(url.searchParams.get('page') || 1);

    // Find matches where a suspended player appears in the composition
    const matches = await Match.find({
      organizationId: orgId,
      homologue: true,
      'feuilleMatchElectronique.homeComposition': { $exists: true, $not: { $size: 0 } },
    })
      .populate('homeClubId', 'nom code')
      .populate('awayClubId', 'nom code')
      .sort({ dateValidation: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const anomalies: any[] = [];

    for (const match of matches) {
      const participantIds = [
        ...(match.feuilleMatchElectronique?.homeComposition || []),
        ...(match.feuilleMatchElectronique?.awayComposition || []),
      ].map((id: any) => id.toString());

      if (participantIds.length === 0) continue;

      const suspensions = await Suspension.find({
        joueurId: { $in: participantIds },
        status: { $in: ['ACTIVE', 'PROVISIONAL'] },
        organizationId: orgId,
      })
        .populate('joueurId', 'nom prenom numeroMaillot')
        .lean();

      for (const s of suspensions) {
        const joueurIdStr = s.joueurId!._id?.toString() || s.joueurId.toString();
        if (participantIds.includes(joueurIdStr)) {
          anomalies.push({
            match,
            suspension: s,
            joueurId: joueurIdStr,
            type: 'SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT',
            notes: `Joueur suspendu (${s.suspensionType}) enregistré dans la composition`,
          });
        }
      }
    }

    return NextResponse.json({ anomalies, total: anomalies.length, page, limit });
  } catch (error) {
    return apiError(error, 'GET /api/admin/discipline/anomalies');
  }
}
