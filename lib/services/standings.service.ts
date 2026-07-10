import mongoose from 'mongoose';
import Match from '../models/Match';
import Competition from '../models/Competition';
import Standings from '../models/Standings';
import Round from '../models/Round';
import AuditService from './audit.service';
import connectDB from '../db';

/**
 * StandingsService — Rebuild competition standings from scratch.
 * Source of truth: finalized (homologued) matches only.
 * §5.10: Stable tiebreaker ordering: Points → GD → GF.
 */
export class StandingsService {
  static async rebuildCompetitionStandings(
    competitionId: string | mongoose.Types.ObjectId,
    actorId?: string
  ) {
    await connectDB();

    const competition = await Competition.findById(competitionId);
    if (!competition) throw new Error('Compétition introuvable');

    const clubIds = competition.clubsParticipants.map((id) => id.toString());

    // Initialize rows map
    const rows: Record<string, {
      clubId: mongoose.Types.ObjectId;
      points: number; played: number; won: number; drawn: number; lost: number;
      goalsFor: number; goalsAgainst: number; form: string[];
    }> = {};

    for (const id of clubIds) {
      rows[id] = {
        clubId: new mongoose.Types.ObjectId(id),
        points: 0, played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, form: [],
      };
    }

    // Fetch all finalized matches sorted by date
    const matches = await Match.find({
      competitionId,
      homologue: true,
      statut: { $in: ['Terminé', 'Forfait'] },
    }).sort({ date: 1 });

    const pts = competition.reglementPoints;

    for (const m of matches) {
      const homeId = m.homeClubId.toString();
      const awayId = m.awayClubId.toString();

      const home = rows[homeId];
      const away = rows[awayId];
      if (!home || !away) continue;

      // Handle forfeit scores
      const scoreHome = m.forfeitScore?.home ?? m.scoreHome;
      const scoreAway = m.forfeitScore?.away ?? m.scoreAway;

      home.played++; away.played++;
      home.goalsFor += scoreHome; home.goalsAgainst += scoreAway;
      away.goalsFor += scoreAway; away.goalsAgainst += scoreHome;

      if (scoreHome > scoreAway) {
        home.won++; away.lost++;
        home.points += pts.victoire; away.points += pts.defaite;
        home.form.push('W'); away.form.push('L');
      } else if (scoreAway > scoreHome) {
        away.won++; home.lost++;
        away.points += pts.victoire; home.points += pts.defaite;
        away.form.push('W'); home.form.push('L');
      } else {
        home.drawn++; away.drawn++;
        home.points += pts.nul; away.points += pts.nul;
        home.form.push('D'); away.form.push('D');
      }

      // Keep only last 5 form results
      if (home.form.length > 5) home.form = home.form.slice(-5);
      if (away.form.length > 5) away.form = away.form.slice(-5);
    }

    // Sort: Points → GD → GF (stable)
    const sorted = Object.values(rows).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });

    const standingsRows = sorted.map((r, i) => ({
      ...r,
      position: i + 1,
      goalDifference: r.goalsFor - r.goalsAgainst,
    }));

    // Upsert standings snapshot
    const doc = await Standings.findOneAndUpdate(
      { competitionId },
      {
        organizationId: competition.organizationId,
        saisonId: competition.saisonId,
        competitionId,
        rows: standingsRows,
        calculatedAt: new Date(),
        matchesProcessed: matches.length,
      },
      { upsert: true, new: true }
    );

    // Also sync embedded classement on competition for legacy access
    competition.classement = standingsRows.map((r) => ({
      clubId: r.clubId,
      position: r.position,
      points: r.points,
      matchesJoues: r.played,
      victoires: r.won,
      nuls: r.drawn,
      defaites: r.lost,
      butsMarques: r.goalsFor,
      butsEncaisses: r.goalsAgainst,
      difference: r.goalDifference,
    }));
    await competition.save();

    if (actorId) {
      await AuditService.log({
        actor: { id: actorId, role: 'FTF_ADMIN' },
        action: 'STANDINGS_REBUILT',
        entityType: 'Competition',
        entityId: competitionId,
        after: { matchesProcessed: matches.length, calculatedAt: doc.calculatedAt },
        organizationId: competition.organizationId?.toString(),
      });
    }

    return doc;
  }
}

export default StandingsService;
