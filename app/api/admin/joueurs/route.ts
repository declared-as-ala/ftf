import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import Joueur from '@/lib/models/Joueur';
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

    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');

    const query: any = {};
    if (clubId) {
      query.clubId = clubId;
    }

    const { skip, limit } = parsePagination(new URL(req.url).searchParams);

    const joueurs = await Joueur.find(query)
      .populate('clubId', 'nom')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(joueurs);
  } catch (error: any) {
    console.error('GET /api/admin/joueurs error:', error);
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
    const licence = String(formData.get('licence') || '').trim();
    const nationalite = String(formData.get('nationalite') || '').trim();
    const position = String(formData.get('position') || '').trim() as any;
    const clubId = String(formData.get('clubId') || '').trim();
    const dateNaissanceStr = String(formData.get('dateNaissance') || '').trim();
    const lieuNaissance = String(formData.get('lieuNaissance') || '').trim() || undefined;
    const numeroMaillot = Number(formData.get('numeroMaillot') || 0) || undefined;
    const taille = Number(formData.get('taille') || 0) || undefined;
    const poids = Number(formData.get('poids') || 0) || undefined;
    const piedPrefere = String(formData.get('piedPrefere') || '').trim() || undefined;

    if (!nom || !prenom || !licence || !nationalite || !position || !clubId || !dateNaissanceStr) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return NextResponse.json({ error: 'Club introuvable' }, { status: 400 });
    }

    const dateNaissance = new Date(dateNaissanceStr);

    let photoPath: string | undefined;
    const photoFile = formData.get('photo');
    if (photoFile && photoFile instanceof File) {
      photoPath = await saveImageUpload(photoFile, 'joueurs', 'joueur');
    }

    const joueur = await Joueur.create({
      nom,
      prenom,
      licence,
      nationalite,
      position,
      clubId,
      dateNaissance,
      lieuNaissance,
      numeroMaillot,
      taille,
      poids,
      piedPrefere,
      ...(photoPath ? { photo: photoPath } : {}),
    });

    return NextResponse.json(joueur, { status: 201 });
  } catch (error: any) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/admin/joueurs error:', error);
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
      return NextResponse.json({ error: 'Missing player id' }, { status: 400 });
    }

    const nom = String(formData.get('nom') || '').trim();
    const prenom = String(formData.get('prenom') || '').trim();
    const licence = String(formData.get('licence') || '').trim();
    const nationalite = String(formData.get('nationalite') || '').trim();
    const position = String(formData.get('position') || '').trim() as any;
    const clubId = String(formData.get('clubId') || '').trim();
    const dateNaissanceStr = String(formData.get('dateNaissance') || '').trim();
    const lieuNaissance = String(formData.get('lieuNaissance') || '').trim() || undefined;
    const numeroMaillot = Number(formData.get('numeroMaillot') || 0) || undefined;
    const taille = Number(formData.get('taille') || 0) || undefined;
    const poids = Number(formData.get('poids') || 0) || undefined;
    const piedPrefere = String(formData.get('piedPrefere') || '').trim() || undefined;

    if (!nom || !prenom || !licence || !nationalite || !position || !clubId || !dateNaissanceStr) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return NextResponse.json({ error: 'Club introuvable' }, { status: 400 });
    }

    const dateNaissance = new Date(dateNaissanceStr);

    const updateData: any = {
      nom,
      prenom,
      licence,
      nationalite,
      position,
      clubId,
      dateNaissance,
      lieuNaissance,
      numeroMaillot,
      taille,
      poids,
      piedPrefere,
    };

    const photoFile = formData.get('photo');
    if (photoFile && photoFile instanceof File) {
      const photoPath = await saveImageUpload(photoFile, 'joueurs', 'joueur');
      updateData.photo = photoPath;
    }

    const updated = await Joueur.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) {
      return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('PUT /api/admin/joueurs error:', error);
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
      return NextResponse.json({ error: 'Missing player id' }, { status: 400 });
    }

    const deleted = await Joueur.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/admin/joueurs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


