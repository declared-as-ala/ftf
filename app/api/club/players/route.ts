import { NextResponse } from 'next/server';
import { requireClub, apiError, parsePagination, escapeRegex } from '@/lib/api';
import connectDB from '@/lib/db';
import Joueur from '@/lib/models/Joueur';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const position = searchParams.get('position');
    const search = searchParams.get('search');
    const { skip, limit } = parsePagination(searchParams);

    const query: any = { clubId };
    if (status) query.status = status;
    if (position) query.position = position;
    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { nom: { $regex: safe, $options: 'i' } },
        { prenom: { $regex: safe, $options: 'i' } },
        { licence: { $regex: safe, $options: 'i' } },
      ];
    }

    const joueurs = await Joueur.find(query)
      .sort({ numeroMaillot: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Joueur.countDocuments(query);

    return NextResponse.json({ joueurs, total });
  } catch (error) {
    return apiError(error, 'GET /api/club/players');
  }
}
