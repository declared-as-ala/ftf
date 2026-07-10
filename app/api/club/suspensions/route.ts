import { NextResponse } from 'next/server';
import { requireClub, apiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import Suspension from '@/lib/models/Suspension';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const suspensionType = searchParams.get('suspensionType');
    const { skip, limit } = parsePagination(searchParams);

    const query: any = { clubId };
    if (status) query.status = status;
    if (suspensionType) query.suspensionType = suspensionType;

    const suspensions = await Suspension.find(query)
      .populate('joueurId', 'nom prenom numeroMaillot')
      .populate('sourceMatchId', 'date scoreHome scoreAway')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Suspension.countDocuments(query);

    return NextResponse.json({ suspensions, total });
  } catch (error) {
    return apiError(error, 'GET /api/club/suspensions');
  }
}
