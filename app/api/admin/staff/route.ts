import { NextResponse } from 'next/server';
import { requireAdmin, apiError, parsePagination, escapeRegex } from '@/lib/api';
import connectDB from '@/lib/db';
import Staff from '@/lib/models/Staff';
import '@/lib/models/Club';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const { skip, limit } = parsePagination(searchParams);

    const query: Record<string, unknown> = {};
    if (clubId) query.clubId = clubId;
    if (type) query.type = type;
    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { nom: { $regex: safe, $options: 'i' } },
        { prenom: { $regex: safe, $options: 'i' } },
      ];
    }

    const [staff, total] = await Promise.all([
      Staff.find(query)
        .populate('clubId', 'nom code logo')
        .sort({ clubId: 1, type: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Staff.countDocuments(query),
    ]);

    return NextResponse.json({ staff, total });
  } catch (error) {
    return apiError(error, 'GET /api/admin/staff');
  }
}
