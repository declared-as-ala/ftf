import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin, apiError, ApiError, parsePagination } from '@/lib/api';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import Club from '@/lib/models/Club';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const { skip, limit } = parsePagination(searchParams);

    const query: Record<string, unknown> = {};
    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.find(query)
      .populate('clubId', 'nom')
      .select('email name role status clubId createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(query);

    return NextResponse.json({ users, total });
  } catch (error) {
    return apiError(error, 'GET /api/admin/users');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const body = await req.json();
    const { email, name, password, role, clubId } = body;

    if (!email || !password || !role) {
      throw new ApiError(400, 'Email, mot de passe et rôle requis');
    }

    if (role === 'CLUB_ADMIN' && !clubId) {
      throw new ApiError(400, 'clubId requis pour un administrateur de club');
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new ApiError(409, 'Un utilisateur avec cet email existe déjà');
    }

    if (role === 'CLUB_ADMIN') {
      const club = await Club.findById(clubId);
      if (!club) throw new ApiError(400, 'Club introuvable');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role,
      clubId: role === 'CLUB_ADMIN' ? clubId : undefined,
      organizationId: session.user.organizationId,
      status: 'ACTIVE',
      mustChangePassword: false,
    });

    return NextResponse.json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        clubId: user.clubId,
        createdAt: user.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    return apiError(error, 'POST /api/admin/users');
  }
}
