import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const user = await User.findById(id)
      .populate('clubId', 'nom')
      .select('email name role status clubId createdAt lastLoginAt mustChangePassword')
      .lean();

    if (!user) throw new ApiError(404, 'Utilisateur introuvable');
    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error, 'GET /api/admin/users/[id]');
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const body = await req.json();

    const user = await User.findById(id);
    if (!user) throw new ApiError(404, 'Utilisateur introuvable');

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.mustChangePassword !== undefined) updateData.mustChangePassword = body.mustChangePassword;

    if (body.password) {
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    if (body.role && body.role !== user.role) {
      throw new ApiError(400, 'Le rôle ne peut pas être modifié après la création');
    }

    const updated = await User.findByIdAndUpdate(id, updateData, { new: true })
      .populate('clubId', 'nom')
      .select('email name role status clubId createdAt lastLoginAt mustChangePassword');

    return NextResponse.json({ user: updated });
  } catch (error) {
    return apiError(error, 'PUT /api/admin/users/[id]');
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, 'Utilisateur introuvable');

    // Soft-disable instead of delete for audit trail
    user.status = 'DISABLED';
    await user.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, 'DELETE /api/admin/users/[id]');
  }
}
