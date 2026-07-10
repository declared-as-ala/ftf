import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireClub, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { session } = await requireClub();
    await connectDB();

    const user = await User.findById(session.user.id).select('email name role status').lean();
    if (!user) {
      throw new ApiError(404, 'Utilisateur introuvable');
    }

    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error, 'GET /api/club/profile');
  }
}

export async function PUT(req: Request) {
  try {
    const { session } = await requireClub();
    await connectDB();

    const body = await req.json();
    const { name, currentPassword, newPassword } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Mot de passe actuel requis pour changer le mot de passe' },
          { status: 400 }
        );
      }

      const user = await User.findById(session.user.id).select('+password');
      if (!user) {
        throw new ApiError(404, 'Utilisateur introuvable');
      }

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return NextResponse.json(
          { error: 'Mot de passe actuel incorrect' },
          { status: 400 }
        );
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      updateData.password = hashed;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 });
    }

    const updated = await User.findByIdAndUpdate(session.user.id, updateData, { new: true })
      .select('email name role status');

    return NextResponse.json({ user: updated });
  } catch (error) {
    return apiError(error, 'PUT /api/club/profile');
  }
}
