import { NextResponse } from 'next/server';
import { requireAdmin, apiError, ApiError } from '@/lib/api';
import connectDB from '@/lib/db';
import ReportService, { REPORT_CATALOG, type ReportType } from '@/lib/services/report.service';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ catalog: REPORT_CATALOG });
  } catch (error) {
    return apiError(error, 'GET /api/admin/reports');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const body = await req.json();
    const { type, competitionId, saisonId, clubId, format } = body;

    if (!type) {
      throw new ApiError(400, 'Type de rapport requis');
    }

    const validTypes: ReportType[] = REPORT_CATALOG.map((r) => r.type);
    if (!validTypes.includes(type)) {
      throw new ApiError(400, `Type de rapport invalide: ${type}`);
    }

    const result = await ReportService.generate(type as ReportType, {
      competitionId,
      saisonId,
      clubId,
      format: format || 'csv',
    });

    const csv = ReportService.toCsv(result.data);

    return NextResponse.json({
      success: true,
      filename: result.filename,
      data: result.data,
      csv,
      count: result.data.length,
      generatedBy: session.user.id,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error, 'POST /api/admin/reports');
  }
}
