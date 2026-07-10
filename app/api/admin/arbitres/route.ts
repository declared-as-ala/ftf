import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import Arbitre from '@/lib/models/Arbitre';
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
    const arbitres = await Arbitre.find().sort({ nom: 1, prenom: 1 }).skip(skip).limit(limit).lean();
    return NextResponse.json(arbitres);
  } catch (error: any) {
    console.error('GET /api/admin/arbitres error:', error);
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
    const prenom = String(formData.get('prenom') || '').trim();
    const categorie = String(formData.get('categorie') || '').trim();
    const dateNaissanceStr = String(formData.get('dateNaissance') || '').trim();
    const nationalite = String(formData.get('nationalite') || '').trim();
    const ville = String(formData.get('ville') || '').trim();
    const email = String(formData.get('email') || '').trim() || undefined;
    const telephone = String(formData.get('telephone') || '').trim() || undefined;
    const actifStr = String(formData.get('actif') || '').trim();

    if (!nom || !prenom || !categorie || !dateNaissanceStr || !nationalite || !ville) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    const dateNaissance = new Date(dateNaissanceStr);
    const actif = actifStr === 'true' || actifStr === 'on' || actifStr === '1' || actifStr === '';

    let photoPath: string | undefined;
    const photoFile = formData.get('photo');
    if (photoFile && photoFile instanceof File) {
      photoPath = await saveImageUpload(photoFile, 'arbitres', 'arbitre');
    }

    const arbitre = await Arbitre.create({
      nom,
      prenom,
      categorie,
      dateNaissance,
      nationalite,
      ville,
      email,
      telephone,
      actif,
      ...(photoPath ? { photo: photoPath } : {}),
    });

    return NextResponse.json(arbitre, { status: 201 });
  } catch (error: any) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/admin/arbitres error:', error);
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
      return NextResponse.json({ error: 'Missing arbitre id' }, { status: 400 });
    }

    const nom = String(formData.get('nom') || '').trim();
    const prenom = String(formData.get('prenom') || '').trim();
    const categorie = String(formData.get('categorie') || '').trim();
    const dateNaissanceStr = String(formData.get('dateNaissance') || '').trim();
    const nationalite = String(formData.get('nationalite') || '').trim();
    const ville = String(formData.get('ville') || '').trim();
    const email = String(formData.get('email') || '').trim() || undefined;
    const telephone = String(formData.get('telephone') || '').trim() || undefined;
    const actifStr = String(formData.get('actif') || '').trim();

    if (!nom || !prenom || !categorie || !dateNaissanceStr || !nationalite || !ville) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    const dateNaissance = new Date(dateNaissanceStr);
    const actif = actifStr === 'true' || actifStr === 'on' || actifStr === '1' || actifStr === '';

    const updateData: any = {
      nom,
      prenom,
      categorie,
      dateNaissance,
      nationalite,
      ville,
      email,
      telephone,
      actif,
    };

    const photoFile = formData.get('photo');
    if (photoFile && photoFile instanceof File) {
      const photoPath = await saveImageUpload(photoFile, 'arbitres', 'arbitre');
      updateData.photo = photoPath;
    }

    const updated = await Arbitre.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) {
      return NextResponse.json({ error: 'Arbitre introuvable' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('PUT /api/admin/arbitres error:', error);
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
      return NextResponse.json({ error: 'Missing arbitre id' }, { status: 400 });
    }

    const deleted = await Arbitre.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Arbitre introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/admin/arbitres error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}






