import { NextResponse } from 'next/server';
import { requireClub, apiError } from '@/lib/api';
import connectDB from '@/lib/db';
import Match from '@/lib/models/Match';
import EligibilityService from '@/lib/services/eligibility.service';
import Competition from '@/lib/models/Competition';
import DisciplinaryRuleSet from '@/lib/models/DisciplinaryRuleSet';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { clubId } = await requireClub();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get('matchId');

    if (matchId) {
      const match = await Match.findById(matchId).lean();
      if (!match) {
        return NextResponse.json({ error: 'Match introuvable' }, { status: 404 });
      }

      const isParticipant =
        match.homeClubId.toString() === clubId ||
        match.awayClubId.toString() === clubId;
      if (!isParticipant) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }

      const competition = await Competition.findById(match.competitionId).lean();
      let yellowThreshold = 3;
      if (competition?.disciplinaryRuleSetId) {
        const ruleSet = await DisciplinaryRuleSet.findById(competition.disciplinaryRuleSetId).lean();
        if (ruleSet) yellowThreshold = ruleSet.yellowCardThreshold;
      }

      const eligibility = await EligibilityService.getMatchEligibility(
        matchId,
        match.homeClubId.toString(),
        match.awayClubId.toString(),
        match.saisonId.toString(),
        yellowThreshold
      );

      return NextResponse.json({
        matchId,
        homeClubId: match.homeClubId,
        awayClubId: match.awayClubId,
        ...eligibility,
      });
    }

    const upcomingMatches = await Match.find({
      $or: [{ homeClubId: clubId }, { awayClubId: clubId }],
      statut: { $in: ['Programmé', 'En Cours'] },
    })
      .populate('homeClubId awayClubId competitionId', 'nom nom nom')
      .sort({ date: 1 })
      .limit(20)
      .lean();

    return NextResponse.json({ upcomingMatches });
  } catch (error) {
    return apiError(error, 'GET /api/club/eligibility');
  }
}
