import DisciplinaryCard from '../models/DisciplinaryCard';
import Suspension from '../models/Suspension';
import SuspensionServiceEntry from '../models/SuspensionServiceEntry';
import DisciplinaryAnomaly from '../models/DisciplinaryAnomaly';
import Notification from '../models/Notification';

export class MatchDisciplineImpactService {
  static async get(matchId: string, organizationId: string) {
    const [cards, suspensions, servingEntries, anomalies, notifications] = await Promise.all([
      DisciplinaryCard.find({ organizationId, matchId }).populate('joueurId', 'nom prenom numeroMaillot').populate('clubId', 'nom code').lean(),
      Suspension.find({ organizationId, sourceMatchId: matchId }).populate('joueurId', 'nom prenom numeroMaillot').populate('clubId', 'nom code').lean(),
      SuspensionServiceEntry.find({ organizationId, matchId }).populate('joueurId', 'nom prenom numeroMaillot').populate('clubId', 'nom code').lean(),
      DisciplinaryAnomaly.find({ organizationId, matchId }).populate('playerId', 'nom prenom numeroMaillot').populate('clubId', 'nom code').lean(),
      Notification.find({ organizationId, entityType: { $in: ['Match', 'Suspension'] }, $or: [{ entityId: matchId }, { dedupeKey: { $regex: matchId } }] }).select('type subject recipientClubId read createdAt').lean(),
    ]);
    return { cards, suspensions, servingEntries, anomalies, notifications, summary: { cards: cards.length, suspensions: suspensions.length, served: servingEntries.filter((entry) => entry.counted && !entry.reversedAt).length, anomalies: anomalies.filter((item) => item.status === 'OPEN').length, notifications: notifications.length } };
  }
}
export default MatchDisciplineImpactService;
