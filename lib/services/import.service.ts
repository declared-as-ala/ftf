import mongoose from 'mongoose';
import Papa from 'papaparse';
import connectDB from '@/lib/db';
import Club from '@/lib/models/Club';
import Joueur from '@/lib/models/Joueur';
import Match from '@/lib/models/Match';
import Competition from '@/lib/models/Competition';
import Saison from '@/lib/models/Saison';

export type ImportEntity = 'clubs' | 'players' | 'fixtures' | 'results';

export interface ImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
  warnings: string[];
  valid: boolean;
}

export interface ImportResult {
  entity: ImportEntity;
  totalRows: number;
  validRows: number;
  errorRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
}

interface ImportContext {
  organizationId: string;
  userId: string;
}

export const TEMPLATE_EXAMPLES: Record<ImportEntity, { filename: string; headers: string[]; example: string }> = {
  clubs: {
    filename: 'clubs-template.csv',
    headers: ['nom', 'code', 'slug', 'stade', 'ville', 'emailOfficiel', 'fondation', 'couleurs', 'siteweb', 'telephone'],
    example: 'Club Sportif,CS,cs,Stade Municipal,Tunis,contact@cs.tn,1920,Rouge et Blanc,https://cs.tn,+21650123456',
  },
  players: {
    filename: 'joueurs-template.csv',
    headers: ['nom', 'prenom', 'licence', 'nationalite', 'position', 'clubCode', 'dateNaissance', 'numeroMaillot', 'piedPrefere'],
    example: 'Ben Ali,Mohamed,TUN-001,Tunisienne,Milieu,EST,2000-01-15,10,Droit',
  },
  fixtures: {
    filename: 'calendrier-template.csv',
    headers: ['competitionCode', 'journee', 'date', 'heure', 'stade', 'homeClubCode', 'awayClubCode'],
    example: 'L1,1,2025-08-15,16:00,Stade Olympique,EST,CA',
  },
  results: {
    filename: 'resultats-template.csv',
    headers: ['competitionCode', 'journee', 'homeClubCode', 'awayClubCode', 'scoreHome', 'scoreAway', 'statut', 'homeGoalscorers', 'awayGoalscorers'],
    example: 'L1,1,EST,CA,2,1,Terminé,"Joueur1(J10),Joueur2(J45)","Joueur3(J30)"',
  },
};

export function getTemplate(entity: ImportEntity): string {
  const t = TEMPLATE_EXAMPLES[entity];
  return t.headers.join(',') + '\n' + t.example;
}

export function validateCsv(
  csvContent: string,
  entity: ImportEntity
): { rows: ImportRow[]; headers: string[] } {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const template = TEMPLATE_EXAMPLES[entity];
  const headers = result.meta.fields || [];

  const missingHeaders = template.headers.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    const allHeaders = [...new Set([...template.headers, ...headers])];
    const row: ImportRow = {
      rowNumber: 0,
      raw: {},
      errors: [`En-têtes manquants: ${missingHeaders.join(', ')}`],
      warnings: [],
      valid: false,
    };
    return { rows: [row], headers: allHeaders };
  }

  const rows: ImportRow[] = result.data.map((raw, i) => {
    const row: ImportRow = {
      rowNumber: i + 2,
      raw,
      errors: [],
      warnings: [],
      valid: true,
    };

    for (const h of template.headers) {
      if (!raw[h] || !raw[h].trim()) {
        row.errors.push(`"${h}" est requis`);
        row.valid = false;
      }
    }

    return row;
  });

  return { rows, headers };
}

export class ImportService {
  static async process(
    entity: ImportEntity,
    rows: ImportRow[],
    ctx: ImportContext
  ): Promise<ImportResult> {
    await connectDB();

    const result: ImportResult = {
      entity,
      totalRows: rows.length,
      validRows: 0,
      errorRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
    };

    const orgId = new mongoose.Types.ObjectId(ctx.organizationId);

    for (const row of rows) {
      if (!row.valid) {
        result.errorRows++;
        result.errors.push({ row: row.rowNumber, message: row.errors.join('; ') });
        continue;
      }

      try {
        switch (entity) {
          case 'clubs':
            await this.importClub(row, orgId, result);
            break;
          case 'players':
            await this.importPlayer(row, orgId, result);
            break;
          case 'fixtures':
            await this.importFixture(row, orgId, result);
            break;
          case 'results':
            await this.importResult(row, orgId, result);
            break;
        }
      } catch (err: any) {
        result.errorRows++;
        result.errors.push({ row: row.rowNumber, message: err.message });
      }
    }

    result.validRows = result.totalRows - result.errorRows;
    return result;
  }

  private static async importClub(row: ImportRow, orgId: mongoose.Types.ObjectId, result: ImportResult) {
    const existing = await Club.findOne({ code: row.raw.code, organizationId: orgId });
    const data = {
      organizationId: orgId,
      nom: row.raw.nom,
      code: row.raw.code,
      slug: row.raw.slug || row.raw.code?.toLowerCase(),
      stade: row.raw.stade,
      ville: row.raw.ville,
      emailOfficiel: row.raw.emailOfficiel,
      fondation: parseInt(row.raw.fondation) || new Date().getFullYear(),
      couleurs: row.raw.couleurs?.split(',').map((c: string) => c.trim()).filter(Boolean) || [],
      siteweb: row.raw.siteweb,
      telephone: row.raw.telephone,
    };

    if (existing) {
      await Club.updateOne({ _id: existing._id }, { $set: data });
      result.updated++;
    } else {
      await Club.create(data);
      result.created++;
    }
  }

  private static async importPlayer(row: ImportRow, orgId: mongoose.Types.ObjectId, result: ImportResult) {
    const club = await Club.findOne({ code: row.raw.clubCode, organizationId: orgId });
    if (!club) throw new Error(`Club "${row.raw.clubCode}" introuvable`);

    const validPositions = ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'];
    const position = validPositions.includes(row.raw.position) ? row.raw.position : 'Milieu';

    const existing = await Joueur.findOne({ licence: row.raw.licence });
    const data = {
      organizationId: orgId,
      nom: row.raw.nom,
      prenom: row.raw.prenom,
      licence: row.raw.licence,
      nationalite: row.raw.nationalite || 'Tunisienne',
      position,
      clubId: club._id,
      dateNaissance: new Date(row.raw.dateNaissance),
      numeroMaillot: parseInt(row.raw.numeroMaillot) || undefined,
      piedPrefere: (['Gauche', 'Droit', 'Les deux'].includes(row.raw.piedPrefere) ? row.raw.piedPrefere : undefined) as any,
      status: 'ACTIVE',
    };

    if (existing) {
      await Joueur.updateOne({ _id: existing._id }, { $set: data });
      result.updated++;
    } else {
      await Joueur.create(data);
      result.created++;
    }
  }

  private static async importFixture(row: ImportRow, orgId: mongoose.Types.ObjectId, result: ImportResult) {
    const competition = await Competition.findOne({ code: row.raw.competitionCode, organizationId: orgId });
    if (!competition) throw new Error(`Compétition "${row.raw.competitionCode}" introuvable`);

    const homeClub = await Club.findOne({ code: row.raw.homeClubCode, organizationId: orgId });
    if (!homeClub) throw new Error(`Club domicile "${row.raw.homeClubCode}" introuvable`);
    const awayClub = await Club.findOne({ code: row.raw.awayClubCode, organizationId: orgId });
    if (!awayClub) throw new Error(`Club extérieur "${row.raw.awayClubCode}" introuvable`);

    const journee = parseInt(row.raw.journee) || 1;
    const dateStr = `${row.raw.date}T${row.raw.heure || '18:00'}:00.000Z`;
    const date = new Date(dateStr);

    const existing = await Match.findOne({
      competitionId: competition._id,
      journee,
      homeClubId: homeClub._id,
      awayClubId: awayClub._id,
    });

    const data = {
      organizationId: orgId,
      saisonId: competition.saisonId,
      competitionId: competition._id,
      journee,
      homeClubId: homeClub._id,
      awayClubId: awayClub._id,
      date,
      stade: row.raw.stade || homeClub.stade,
      statut: 'Programmé' as const,
      scoreHome: 0,
      scoreAway: 0,
      isOfficial: true,
      homologue: false,
      processingVersion: 0,
    };

    if (existing) {
      await Match.updateOne({ _id: existing._id }, { $set: data });
      result.updated++;
    } else {
      await Match.create(data);
      result.created++;
    }
  }

  private static async importResult(row: ImportRow, orgId: mongoose.Types.ObjectId, result: ImportResult) {
    const competition = await Competition.findOne({ code: row.raw.competitionCode, organizationId: orgId });
    if (!competition) throw new Error(`Compétition "${row.raw.competitionCode}" introuvable`);

    const homeClub = await Club.findOne({ code: row.raw.homeClubCode, organizationId: orgId });
    if (!homeClub) throw new Error(`Club domicile "${row.raw.homeClubCode}" introuvable`);
    const awayClub = await Club.findOne({ code: row.raw.awayClubCode, organizationId: orgId });
    if (!awayClub) throw new Error(`Club extérieur "${row.raw.awayClubCode}" introuvable`);

    const journee = parseInt(row.raw.journee) || 1;
    const scoreHome = parseInt(row.raw.scoreHome) || 0;
    const scoreAway = parseInt(row.raw.scoreAway) || 0;
    const statut = (row.raw.statut as any) || 'Terminé';

    const match = await Match.findOne({
      competitionId: competition._id,
      journee,
      homeClubId: homeClub._id,
      awayClubId: awayClub._id,
    });
    if (!match) throw new Error(`Match ${homeClub.nom} vs ${awayClub.nom} (J${journee}) introuvable`);

    const evenements: any[] = [];

    if (row.raw.homeGoalscorers) {
      row.raw.homeGoalscorers.split(',').forEach((entry: string) => {
        const match2 = entry.trim().match(/^(.+?)\((\d+)\)$/);
        if (match2) {
          evenements.push({ type: 'But' as const, minute: parseInt(match2[2]), equipe: 'home' as const, description: match2[1] });
        }
      });
    }

    if (row.raw.awayGoalscorers) {
      row.raw.awayGoalscorers.split(',').forEach((entry: string) => {
        const match2 = entry.trim().match(/^(.+?)\((\d+)\)$/);
        if (match2) {
          evenements.push({ type: 'But' as const, minute: parseInt(match2[2]), equipe: 'away' as const, description: match2[1] });
        }
      });
    }

    await Match.updateOne(
      { _id: match._id },
      { $set: { scoreHome, scoreAway, statut, evenements } }
    );
    result.updated++;
  }
}

export default ImportService;
