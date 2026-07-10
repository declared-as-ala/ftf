import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import Club from '@/lib/models/Club';
import { saveImageUpload, UploadError } from '@/lib/uploads';
import { parsePagination } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'FTF_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { skip, limit } = parsePagination(new URL(req.url).searchParams);
    const clubs = await Club.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    return NextResponse.json(clubs);
  } catch (error: any) {
    console.error('GET /api/admin/clubs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'FTF_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const formData = await req.formData();

    const nom = String(formData.get('nom') || '').trim();
    const stade = String(formData.get('stade') || '').trim();
    const ville = String(formData.get('ville') || '').trim();
    const emailOfficiel = String(formData.get('emailOfficiel') || '').trim();
    const fondation = Number(formData.get('fondation') || 0);
    const couleursRaw = String(formData.get('couleurs') || '').trim();
    const description = String(formData.get('description') || '').trim() || undefined;
    const siteweb = String(formData.get('siteweb') || '').trim() || undefined;
    const telephone = String(formData.get('telephone') || '').trim() || undefined;

    const couleurs = couleursRaw
      ? couleursRaw.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    let logoPath: string | undefined;
    const logoFile = formData.get('logo');

    if (logoFile && logoFile instanceof File) {
      logoPath = await saveImageUpload(logoFile, 'clubs', 'club');
    }

    const club = await Club.create({
      nom,
      stade,
      ville,
      emailOfficiel,
      fondation,
      couleurs,
      description,
      siteweb,
      telephone,
      ...(logoPath ? { logo: logoPath } : {}),
    });

    return NextResponse.json(club, { status: 201 });
  } catch (error: any) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/admin/clubs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'FTF_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const formData = await req.formData();
    const id = String(formData.get('id') || '').trim();

    if (!id) {
      return NextResponse.json({ error: 'Missing club id' }, { status: 400 });
    }

    const nom = String(formData.get('nom') || '').trim();
    const stade = String(formData.get('stade') || '').trim();
    const ville = String(formData.get('ville') || '').trim();
    const emailOfficiel = String(formData.get('emailOfficiel') || '').trim();
    const fondation = Number(formData.get('fondation') || 0);
    const couleursRaw = String(formData.get('couleurs') || '').trim();
    const description = String(formData.get('description') || '').trim() || undefined;
    const siteweb = String(formData.get('siteweb') || '').trim() || undefined;
    const telephone = String(formData.get('telephone') || '').trim() || undefined;

    const couleurs = couleursRaw
      ? couleursRaw.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    const updateData: any = {
      nom,
      stade,
      ville,
      emailOfficiel,
      fondation,
      couleurs,
      description,
      siteweb,
      telephone,
    };

    const logoFile = formData.get('logo');
    if (logoFile && logoFile instanceof File) {
      const logoPath = await saveImageUpload(logoFile, 'clubs', 'club');
      updateData.logo = logoPath;
    }

    const updated = await Club.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('PUT /api/admin/clubs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'FTF_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing club id' }, { status: 400 });
    }

    const deleted = await Club.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/admin/clubs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
