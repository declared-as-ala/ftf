import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import ImportService, { validateCsv, getTemplate, TEMPLATE_EXAMPLES, type ImportEntity } from '@/lib/services/import.service';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const entity = searchParams.get('entity') as ImportEntity;
    const download = searchParams.get('download');

    if (download === 'template' && entity && TEMPLATE_EXAMPLES[entity]) {
      const csv = getTemplate(entity);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': `attachment; filename="${TEMPLATE_EXAMPLES[entity].filename}"`,
        },
      });
    }

    return NextResponse.json({
      entities: Object.keys(TEMPLATE_EXAMPLES),
      templates: Object.entries(TEMPLATE_EXAMPLES).map(([key, val]) => ({
        entity: key,
        filename: val.filename,
        headers: val.headers,
      })),
    });
  } catch (error) {
    return apiError(error, 'GET /api/admin/imports');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const orgId = session.user.organizationId;
    if (!orgId) throw new ApiError(400, 'Organisation non configurée');

    const formData = await req.formData();
    const entity = formData.get('entity') as ImportEntity;
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string; // 'validate' | 'process'

    if (!entity || !file) {
      throw new ApiError(400, 'Entity et fichier requis');
    }

    if (!TEMPLATE_EXAMPLES[entity]) {
      throw new ApiError(400, `Type d'import invalide: ${entity}`);
    }

    const csvText = await file.text();
    const { rows: parsedRows, headers } = validateCsv(csvText, entity);
    const rows = await ImportService.validateAsync(entity, parsedRows, orgId);

    if (mode === 'process') {
      const allow = formData.get('allow') === 'true';
      if (!allow) {
        throw new ApiError(400, 'Confirmation requise pour lancer l\'import');
      }

      const result = await ImportService.process(entity, rows, {
        organizationId: orgId,
        userId: session.user.id,
      });

      return NextResponse.json({ result });
    }

    const validCount = rows.filter((r) => r.valid).length;
    const errorCount = rows.filter((r) => !r.valid).length;

    return NextResponse.json({
      entity,
      headers,
      totalRows: rows.length,
      validCount,
      errorCount,
      preview: rows.slice(0, 100),
    });
  } catch (error) {
    return apiError(error, 'POST /api/admin/imports');
  }
}
