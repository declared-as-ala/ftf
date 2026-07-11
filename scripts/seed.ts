import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI non trouvé dans .env.local');
if (process.env.NODE_ENV === 'production') throw new Error('Seed refusé en production.');
if (!process.argv.includes('--force')) {
  throw new Error('Le seed efface toute la base. Relancez avec : npm run seed -- --force');
}

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../lib/db';
import { clubLogoSvg, playerAvatarSvg, writeSvgAsset } from './asset-helpers';
import Organization from '../lib/models/Organization';
import User from '../lib/models/User';
import Club from '../lib/models/Club';
import Joueur from '../lib/models/Joueur';
import Staff from '../lib/models/Staff';
import Arbitre from '../lib/models/Arbitre';
import Saison from '../lib/models/Saison';
import Competition from '../lib/models/Competition';
import Round from '../lib/models/Round';
import Match from '../lib/models/Match';
import DisciplinaryRuleSet from '../lib/models/DisciplinaryRuleSet';
import DisciplinaryCard from '../lib/models/DisciplinaryCard';
import Suspension from '../lib/models/Suspension';
import SuspensionServiceEntry from '../lib/models/SuspensionServiceEntry';
import Standings from '../lib/models/Standings';
import Notification from '../lib/models/Notification';
import AuditLog from '../lib/models/AuditLog';

type ClubSeed = {
  code: string; nom: string; shortName: string; ville: string; stade: string;
  capacite: number; fondation: number; couleurs: string[];
};

// Participants de Ligue Professionnelle 1 2025-2026. Les identités de clubs,
// villes et stades sont des données publiques; les joueurs sont des fixtures
// déterministes et ne prétendent pas reproduire une liste d'engagement officielle.
const CLUBS: ClubSeed[] = [
  { code: 'EST', nom: 'Espérance Sportive de Tunis', shortName: 'ES Tunis', ville: 'Tunis', stade: 'Stade Olympique de Radès', capacite: 60000, fondation: 1919, couleurs: ['Rouge', 'Jaune'] },
  { code: 'CA', nom: 'Club Africain', shortName: 'Club Africain', ville: 'Tunis', stade: 'Stade Olympique de Radès', capacite: 60000, fondation: 1920, couleurs: ['Rouge', 'Blanc'] },
  { code: 'ST', nom: 'Stade Tunisien', shortName: 'Stade Tunisien', ville: 'Le Bardo', stade: 'Stade Hédi-Enneifer', capacite: 11000, fondation: 1948, couleurs: ['Rouge', 'Vert', 'Blanc'] },
  { code: 'USM', nom: 'Union Sportive Monastirienne', shortName: 'US Monastir', ville: 'Monastir', stade: 'Stade Mustapha-Ben-Jannet', capacite: 25000, fondation: 1923, couleurs: ['Bleu', 'Blanc'] },
  { code: 'ESS', nom: 'Étoile Sportive du Sahel', shortName: 'ES Sahel', ville: 'Sousse', stade: 'Stade Olympique de Sousse', capacite: 40000, fondation: 1925, couleurs: ['Rouge', 'Blanc'] },
  { code: 'CSS', nom: 'Club Sportif Sfaxien', shortName: 'CS Sfaxien', ville: 'Sfax', stade: 'Stade Taïeb-Mehiri', capacite: 22000, fondation: 1928, couleurs: ['Noir', 'Blanc'] },
  { code: 'ESZ', nom: 'Espérance Sportive de Zarzis', shortName: 'ES Zarzis', ville: 'Zarzis', stade: 'Complexe Abdessalem-Kazouz', capacite: 7000, fondation: 1934, couleurs: ['Rouge', 'Jaune'] },
  { code: 'CAB', nom: 'Club Athlétique Bizertin', shortName: 'CA Bizertin', ville: 'Bizerte', stade: 'Stade du 15-Octobre', capacite: 20000, fondation: 1928, couleurs: ['Jaune', 'Noir'] },
  { code: 'ASM', nom: 'Avenir Sportif de La Marsa', shortName: 'AS Marsa', ville: 'La Marsa', stade: 'Stade Abdelaziz-Chtioui', capacite: 6000, fondation: 1939, couleurs: ['Vert', 'Jaune'] },
  { code: 'ESM', nom: 'Étoile Sportive de Métlaoui', shortName: 'ES Métlaoui', ville: 'Métlaoui', stade: 'Stade municipal de Métlaoui', capacite: 5000, fondation: 1950, couleurs: ['Rouge', 'Jaune'] },
  { code: 'ASS', nom: 'Avenir Sportif de Soliman', shortName: 'AS Soliman', ville: 'Soliman', stade: 'Stade municipal de Soliman', capacite: 3000, fondation: 1960, couleurs: ['Vert', 'Blanc'] },
  { code: 'USBG', nom: 'Union Sportive de Ben Guerdane', shortName: 'US Ben Guerdane', ville: 'Ben Guerdane', stade: 'Stade du 7-Mars', capacite: 10000, fondation: 1936, couleurs: ['Jaune', 'Noir'] },
  { code: 'JSK', nom: 'Jeunesse Sportive Kairouanaise', shortName: 'JS Kairouan', ville: 'Kairouan', stade: 'Stade Hamda-Laouani', capacite: 25000, fondation: 1942, couleurs: ['Vert', 'Blanc'] },
  { code: 'ASG', nom: 'Avenir Sportif de Gabès', shortName: 'AS Gabès', ville: 'Gabès', stade: 'Stade de Gabès', capacite: 15000, fondation: 1978, couleurs: ['Rouge', 'Noir'] },
  { code: 'OB', nom: 'Olympique de Béja', shortName: 'Olympique Béja', ville: 'Béja', stade: 'Stade Boujemaa-Kmiti', capacite: 10000, fondation: 1929, couleurs: ['Rouge', 'Blanc'] },
  { code: 'JSO', nom: 'Jeunesse Sportive d’El Omrane', shortName: 'JS El Omrane', ville: 'Tunis', stade: 'Stade Chedly-Zouiten', capacite: 18000, fondation: 1943, couleurs: ['Bleu', 'Blanc'] },
];

const FIRST_NAMES = ['Ahmed', 'Mohamed', 'Youssef', 'Aziz', 'Rayen', 'Firas', 'Oussama', 'Bilel', 'Hamza', 'Aymen', 'Anis', 'Nader', 'Seif', 'Wassim', 'Malek', 'Rami', 'Alaa', 'Skander', 'Mahdi', 'Wael', 'Khalil', 'Chamseddine', 'Houssem', 'Zied', 'Montassar', 'Ghaith', 'Adem', 'Ismail', 'Sami', 'Ali', 'Ilyes', 'Moez'];
const LAST_NAMES = ['Ben Salem', 'Trabelsi', 'Jelassi', 'Mansouri', 'Haddad', 'Gharbi', 'Khalfallah', 'Mabrouk', 'Dridi', 'Ayari', 'Hamrouni', 'Chaabane', 'Ben Amor', 'Msekni', 'Khelifi', 'Abdi', 'Jaziri', 'Chouchane', 'Mejri', 'Touati', 'Ben Hmida', 'Saïdi', 'Ltaief', 'Hajri', 'Romdhane', 'Dhaouadi', 'Chermiti', 'Kacem', 'Nasri', 'Baccouche', 'Ben Youssef', 'Sassi'];
const REFEREES = [['Sadok', 'Selmi'], ['Haythem', 'Guirat'], ['Amir', 'Loussaief'], ['Naim', 'Hosni'], ['Mahrez', 'Melki'], ['Khalil', 'Jaziri'], ['Yassine', 'Harrouch'], ['Walid', 'Jeridi'], ['Ahmed', 'Dhahri'], ['Mohamed', 'Maarouf']];

let randomState = 20252026;
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 4294967296;
}
function pick<T>(items: T[]): T { return items[Math.floor(random() * items.length)]; }
function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

function berger(count: number) {
  const teams = Array.from({ length: count }, (_, i) => i);
  const firstLeg: Array<Array<[number, number]>> = [];
  for (let round = 0; round < count - 1; round++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < count / 2; i++) {
      const a = teams[i]; const b = teams[count - 1 - i];
      pairs.push((round + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    firstLeg.push(pairs);
    teams.splice(1, 0, teams.pop()!);
  }
  return [...firstLeg, ...firstLeg.map(round => round.map(([h, a]) => [a, h] as [number, number]))];
}

async function seed() {
  await connectDB();
  if (!mongoose.connection.db) throw new Error('Connexion MongoDB indisponible');
  console.log(`Base ciblée : ${mongoose.connection.db.databaseName}`);
  console.log('Suppression de toutes les données...');
  const existingCollections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  await Promise.all(existingCollections.map(({ name }) => mongoose.connection.db!.collection(name).deleteMany({})));

  const org = await Organization.create({ name: 'Fédération Tunisienne de Football', code: 'FTF', type: 'FEDERATION', active: true });
  const season = await Saison.create({
    organizationId: org._id, nom: 'Saison 2025-2026', code: '2025-2026', anneeDebut: 2025, anneeFin: 2026,
    dateDebut: new Date('2025-08-01T00:00:00Z'), dateFin: new Date('2026-05-31T23:59:59Z'), active: true, status: 'ACTIVE', isCurrent: true,
    configuration: { seuilCartonsJaunes: 3, suspensionCartonRouge: 1, suspensionStaff: 1 },
  });
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const clubPassword = await bcrypt.hash('Club@123', 10);
  const admin = await User.create({ organizationId: org._id, email: 'admin@ftf.tn', password: adminPassword, name: 'Administrateur FTF', role: 'FTF_ADMIN', status: 'ACTIVE' });

  const clubs = await Club.insertMany(CLUBS.map(c => ({
    organizationId: org._id, nom: c.nom, code: c.code, slug: slug(c.nom), shortName: c.shortName, status: 'ACTIVE',
    logo: writeSvgAsset('clubs', `${c.code}.svg`, clubLogoSvg(c.code, c.couleurs)),
    stade: c.stade, ville: c.ville, couleurs: c.couleurs, fondation: c.fondation,
    emailOfficiel: `${c.code.toLowerCase()}@clubs.ftf.tn`, capaciteStade: c.capacite,
    description: `Club participant à la Ligue Professionnelle 1 2025-2026.`, equipesJeunes: ['U19', 'U21'], equipesFeminines: [], documentsAccreditation: [],
  })));
  await User.insertMany(clubs.map((club, i) => ({ organizationId: org._id, email: `${CLUBS[i].code.toLowerCase()}@club.ftf.tn`, password: clubPassword, name: `Administrateur ${CLUBS[i].shortName}`, role: 'CLUB_ADMIN', status: 'ACTIVE', clubId: club._id })));

  const playersByClub = new Map<string, any[]>();
  const playerDocs: any[] = [];
  clubs.forEach((club, clubIndex) => {
    const squad: any[] = [];
    for (let i = 0; i < 24; i++) {
      const position = i < 3 ? 'Gardien' : i < 11 ? 'Défenseur' : i < 18 ? 'Milieu' : 'Attaquant';
      const prenom = FIRST_NAMES[(clubIndex * 7 + i) % FIRST_NAMES.length];
      const nom = LAST_NAMES[(clubIndex * 11 + i * 3) % LAST_NAMES.length];
      const licence = `FTF-25-${CLUBS[clubIndex].code}-${String(i + 1).padStart(3, '0')}`;
      const initials = `${prenom[0]}${nom[0]}`.toUpperCase();
      const doc = {
        organizationId: org._id, clubId: club._id, prenom, nom, displayName: `${prenom} ${nom}`,
        licence,
        photo: writeSvgAsset('joueurs', `${licence}.svg`, playerAvatarSvg(initials, CLUBS[clubIndex].couleurs)),
        nationalite: i > 20 ? pick(['Algérie', 'Mali', 'Sénégal', 'Côte d’Ivoire']) : 'Tunisie', position,
        dateNaissance: new Date(Date.UTC(1996 + ((clubIndex + i) % 9), (i * 3) % 12, 1 + ((i * 5) % 27))),
        numeroMaillot: i + 1, taille: 170 + ((i * 7 + clubIndex) % 22), poids: 65 + ((i * 5 + clubIndex) % 20),
        piedPrefere: i % 7 === 0 ? 'Les deux' : i % 3 === 0 ? 'Gauche' : 'Droit', category: 'Sénior', status: 'ACTIVE',
        stats: { matchsJoues: 0, buts: 0, passes: 0, cartonsJaunes: 0, cartonsRouges: 0 }, licenceValide: true,
        licenceExpirationDate: new Date('2026-06-30T23:59:59Z'), sanctions: [], transferts: [], carriereHistorique: [],
      };
      playerDocs.push(doc); squad.push(doc);
    }
    playersByClub.set(String(club._id), squad);
  });
  const players = await Joueur.insertMany(playerDocs);
  let playerOffset = 0;
  clubs.forEach(club => { playersByClub.set(String(club._id), players.slice(playerOffset, playerOffset + 24)); playerOffset += 24; });

  await Staff.insertMany(clubs.flatMap((club, i) => [
    { nom: LAST_NAMES[i], prenom: FIRST_NAMES[i], type: 'Entraîneur Principal', clubId: club._id, dateNaissance: new Date(Date.UTC(1968 + i, i % 12, 10)), nationalite: 'Tunisie', licenceValide: true, certifications: [{ type: 'CAF A', dateObtention: new Date('2018-06-01'), organisme: 'CAF' }] },
    { nom: LAST_NAMES[i + 8], prenom: FIRST_NAMES[i + 8], type: 'Entraîneur Adjoint', clubId: club._id, dateNaissance: new Date(Date.UTC(1975 + (i % 8), i % 12, 15)), nationalite: 'Tunisie', licenceValide: true, certifications: [{ type: 'CAF B', dateObtention: new Date('2020-06-01'), organisme: 'CAF' }] },
    { nom: LAST_NAMES[i + 16], prenom: FIRST_NAMES[i + 16], type: 'Médecin', clubId: club._id, dateNaissance: new Date(Date.UTC(1978 + (i % 6), i % 12, 20)), nationalite: 'Tunisie', licenceValide: true, certifications: [{ type: 'Licence Médicale', dateObtention: new Date('2019-06-01'), organisme: 'CNOM' }] },
  ]));
  const referees = await Arbitre.insertMany(REFEREES.map(([prenom, nom], i) => ({ organizationId: org._id, prenom, nom, categorie: i < 5 ? 'Élite' : 'Première Division', dateNaissance: new Date(Date.UTC(1980 + i, i % 12, 12)), nationalite: 'Tunisie', ville: pick(['Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Kairouan']), actif: true, certifications: [{ type: i < 4 ? 'FIFA' : 'FTF', dateObtention: new Date('2021-01-01') }] })));

  const rules = await DisciplinaryRuleSet.create({ organizationId: org._id, seasonId: season._id, name: 'Règlement disciplinaire LP1 2025-2026', version: 1, yellowCardThreshold: 3, yellowCardSuspensionMatches: 1, yellowCardsCountOnlyOfficialMatches: true, clearUnusedYellowCardsAtSeasonEnd: true, redCardCreatesProvisionalSuspension: true, suspensionScope: 'ALL_OFFICIAL_COMPETITIONS', friendlyMatchesCount: false, effectiveFrom: season.dateDebut, effectiveTo: season.dateFin, active: true, sourceDocument: 'Règlements Généraux FTF — Juillet 2025' });
  const competition = await Competition.create({ organizationId: org._id, nom: 'Ligue Professionnelle 1 2025-2026', code: 'LP1-2025-26', type: 'Championnat', niveau: 'National', saisonId: season._id, description: 'Championnat national à 16 clubs, matches aller-retour sur 30 journées.', dateDebut: new Date('2025-08-09T00:00:00Z'), dateFin: new Date('2026-05-14T23:59:59Z'), clubsParticipants: clubs.map(c => c._id), nombreJournees: 30, formatCompetition: 'Championnat', reglementPoints: { victoire: 3, nul: 1, defaite: 0 }, active: true, status: 'ACTIVE', isOfficial: true, tieBreakers: ['POINTS', 'HEAD_TO_HEAD', 'GOAL_DIFFERENCE', 'GOALS_SCORED', 'FAIR_PLAY'], disciplinaryRuleSetId: rules._id });
  await Saison.updateOne({ _id: season._id }, { $set: { clubs: clubs.map(c => c._id), competitions: [competition._id] } });

  const schedule = berger(clubs.length);
  const rounds: any[] = [];
  for (let n = 1; n <= 30; n++) {
    const date = new Date('2025-08-09T15:00:00Z'); date.setUTCDate(date.getUTCDate() + (n - 1) * 7);
    rounds.push(await Round.create({ organizationId: org._id, competitionId: competition._id, saisonId: season._id, number: n, name: `Journée ${n}`, dateDebut: date, dateFin: new Date(date.getTime() + 86400000), status: n <= 22 ? 'COMPLETED' : n === 23 ? 'ACTIVE' : 'SCHEDULED', active: true }));
  }

  const matchDocs: any[] = [];
  const playerStats = new Map<string, { matches: number; goals: number; yellows: number; reds: number }>();
  for (let r = 0; r < schedule.length; r++) {
    for (let game = 0; game < schedule[r].length; game++) {
      const [hi, ai] = schedule[r][game]; const home = clubs[hi]; const away = clubs[ai];
      const date = new Date(rounds[r].dateDebut); date.setUTCHours(game % 3 === 0 ? 13 : game % 3 === 1 ? 15 : 17, game % 2 ? 30 : 0);
      const completed = r < 22; const postponed = r === 22 && game === 2; const draft = r === 22 && game < 5 && !postponed;
      const homeScore = completed || draft ? Math.floor(random() * 4) : 0; const awayScore = completed || draft ? Math.floor(random() * 3) : 0;
      const events: any[] = [];
      const homePlayers = playersByClub.get(String(home._id))!; const awayPlayers = playersByClub.get(String(away._id))!;
      for (let g = 0; g < homeScore; g++) events.push({ type: 'But', minute: 8 + ((g * 23 + game * 7 + r) % 82), joueurId: homePlayers[17 + ((g + r + game) % 7)]._id, equipe: 'home', description: g % 4 === 0 ? 'Penalty' : 'But' });
      for (let g = 0; g < awayScore; g++) events.push({ type: 'But', minute: 12 + ((g * 27 + game * 5 + r) % 78), joueurId: awayPlayers[17 + ((g + r + game + 2) % 7)]._id, equipe: 'away', description: 'But' });
      if (completed || draft) {
        for (let y = 0; y < 2 + ((r + game) % 4); y++) {
          const side = (y + game) % 2 === 0 ? 'home' : 'away'; const squad = side === 'home' ? homePlayers : awayPlayers;
          events.push({ type: 'Carton Jaune', minute: 18 + ((y * 17 + r * 3) % 70), joueurId: squad[3 + ((r + game + y * 2) % 15)]._id, equipe: side, description: pick(['Faute tactique', 'Jeu dangereux', 'Contestation', 'Anti-jeu']) });
        }
        if ((r * 8 + game) % 31 === 0) events.push({ type: 'Carton Rouge', minute: 62 + ((r + game) % 25), joueurId: awayPlayers[4 + ((r + game) % 12)]._id, equipe: 'away', description: 'Faute grave' });
      }
      events.sort((a, b) => a.minute - b.minute);
      matchDocs.push({ organizationId: org._id, saisonId: season._id, competitionId: competition._id, roundId: rounds[r]._id, journee: r + 1, homeClubId: home._id, awayClubId: away._id, date, stade: home.stade, scoreHome: homeScore, scoreAway: awayScore, statut: postponed ? 'Reporté' : completed ? 'Terminé' : draft ? 'Brouillon' : 'Programmé', isOfficial: true, homologue: completed, validePar: completed ? admin._id : undefined, dateValidation: completed ? new Date(date.getTime() + 3 * 3600000) : undefined, processingVersion: completed ? 1 : 0, arbitrePrincipalId: referees[(r * 8 + game) % referees.length]._id, evenements: events, spectateurs: completed ? 1200 + Math.floor(random() * Math.min(home.capaciteStade || 12000, 35000)) : undefined, public: true });
    }
  }
  const matches = await Match.insertMany(matchDocs);

  const cardDocs: any[] = [];
  for (let i = 0; i < matches.length; i++) {
    if (!matches[i].homologue) continue;
    for (const event of matches[i].evenements) {
      const cardType = event.type === 'Carton Jaune' ? 'YELLOW' : event.type === 'Carton Rouge' ? 'DIRECT_RED' : null;
      if (!cardType || !event.joueurId) continue;
      const clubId = event.equipe === 'home' ? matches[i].homeClubId : matches[i].awayClubId;
      cardDocs.push({ organizationId: org._id, matchId: matches[i]._id, competitionId: competition._id, saisonId: season._id, roundId: matches[i].roundId, joueurId: event.joueurId, clubId, cardType, minute: event.minute, accumulationStatus: 'ACTIVE', notes: event.description });
      const key = String(event.joueurId); const s = playerStats.get(key) || { matches: 0, goals: 0, yellows: 0, reds: 0 }; if (cardType === 'YELLOW') s.yellows++; else s.reds++; playerStats.set(key, s);
    }
    for (const event of matches[i].evenements.filter((e: any) => e.type === 'But' && e.joueurId)) {
      const key = String(event.joueurId); const s = playerStats.get(key) || { matches: 0, goals: 0, yellows: 0, reds: 0 }; s.goals++; playerStats.set(key, s);
    }
    for (const clubId of [matches[i].homeClubId, matches[i].awayClubId]) for (const p of playersByClub.get(String(clubId))!) { const key = String(p._id); const s = playerStats.get(key) || { matches: 0, goals: 0, yellows: 0, reds: 0 }; s.matches++; playerStats.set(key, s); }
  }
  const cards = await DisciplinaryCard.insertMany(cardDocs);

  const yellowGroups = new Map<string, any[]>();
  cards.filter(c => c.cardType === 'YELLOW').forEach(c => { const key = String(c.joueurId); yellowGroups.set(key, [...(yellowGroups.get(key) || []), c]); });
  const suspensions: any[] = [];
  for (const group of yellowGroups.values()) {
    for (let start = 0; start + 2 < group.length; start += 3) {
      const source = group[start + 2];
      await DisciplinaryCard.updateMany({ _id: { $in: group.slice(start, start + 3).map(c => c._id) } }, { $set: { accumulationStatus: 'CONSUMED_BY_SUSPENSION' } });
      const suspension = await Suspension.create({ organizationId: org._id, joueurId: source.joueurId, clubId: source.clubId, sourceMatchId: source.matchId, sourceCardId: source._id, sourceSeasonId: season._id, suspensionType: 'YELLOW_ACCUMULATION', status: 'SERVED', scope: 'ALL_OFFICIAL_COMPETITIONS', matchesSuspended: 1, matchesServed: 1, matchesRemaining: 0, automatic: true, createdBy: 'SYSTEM', notes: 'Suspension automatique après trois avertissements.' });
      await DisciplinaryCard.updateMany({ _id: { $in: group.slice(start, start + 3).map(c => c._id) } }, { $set: { linkedSuspensionId: suspension._id } }); suspensions.push(suspension);
    }
  }
  for (const card of cards.filter(c => c.cardType === 'DIRECT_RED').slice(0, 12)) suspensions.push(await Suspension.create({ organizationId: org._id, joueurId: card.joueurId, clubId: card.clubId, sourceMatchId: card.matchId, sourceCardId: card._id, sourceSeasonId: season._id, suspensionType: 'RED_CARD_PROVISIONAL', status: 'PROVISIONAL', scope: 'ALL_OFFICIAL_COMPETITIONS', matchesSuspended: 1, matchesServed: 0, matchesRemaining: 1, createdBy: 'SYSTEM', notes: 'Décision disciplinaire en attente.' }));

  for (const suspension of suspensions.filter(s => s.status === 'SERVED').slice(0, 40)) {
    const sourceIndex = matches.findIndex(m => String(m._id) === String(suspension.sourceMatchId));
    const serving = matches.slice(sourceIndex + 1).find(m => m.homologue && (String(m.homeClubId) === String(suspension.clubId) || String(m.awayClubId) === String(suspension.clubId)));
    if (serving) await SuspensionServiceEntry.create({ organizationId: org._id, suspensionId: suspension._id, matchId: serving._id, joueurId: suspension.joueurId, clubId: suspension.clubId, counted: true, reason: 'OFFICIAL_MATCH_PLAYED', remainingBefore: 1, remainingAfter: 0, processedAt: serving.dateValidation, processedBy: 'SYSTEM' });
  }

  for (const [id, stat] of playerStats) await Joueur.updateOne({ _id: id }, { $set: { stats: { matchsJoues: stat.matches, buts: stat.goals, passes: Math.floor(stat.goals * 0.7), cartonsJaunes: stat.yellows, cartonsRouges: stat.reds } } });
  const table = clubs.map(c => ({ clubId: c._id, position: 0, points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, form: [] as string[] }));
  for (const m of matches.filter(m => m.homologue)) { const h = table.find(r => String(r.clubId) === String(m.homeClubId))!; const a = table.find(r => String(r.clubId) === String(m.awayClubId))!; h.played++; a.played++; h.goalsFor += m.scoreHome; h.goalsAgainst += m.scoreAway; a.goalsFor += m.scoreAway; a.goalsAgainst += m.scoreHome; if (m.scoreHome > m.scoreAway) { h.won++; h.points += 3; a.lost++; h.form.push('W'); a.form.push('L'); } else if (m.scoreHome < m.scoreAway) { a.won++; a.points += 3; h.lost++; a.form.push('W'); h.form.push('L'); } else { h.drawn++; a.drawn++; h.points++; a.points++; h.form.push('D'); a.form.push('D'); } }
  table.forEach(r => { r.goalDifference = r.goalsFor - r.goalsAgainst; r.form = r.form.slice(-5); }); table.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor).forEach((r, i) => r.position = i + 1);
  await Standings.create({ organizationId: org._id, competitionId: competition._id, saisonId: season._id, rows: table, calculatedAt: new Date(), matchesProcessed: matches.filter(m => m.homologue).length });
  await Competition.updateOne({ _id: competition._id }, { $set: { classement: table.map(r => ({ clubId: r.clubId, position: r.position, points: r.points, matchesJoues: r.played, victoires: r.won, nuls: r.drawn, defaites: r.lost, butsMarques: r.goalsFor, butsEncaisses: r.goalsAgainst, difference: r.goalDifference })), matchs: matches.map(m => m._id) } });
  await Saison.updateOne({ _id: season._id }, { $set: { statistiques: { totalMatchs: matches.filter(m => m.homologue).length, totalButs: matches.filter(m => m.homologue).reduce((n, m) => n + m.scoreHome + m.scoreAway, 0), totalCartonsJaunes: cards.filter(c => c.cardType === 'YELLOW').length, totalCartonsRouges: cards.filter(c => c.cardType !== 'YELLOW').length, totalSuspensions: suspensions.length } } });

  await Notification.insertMany([
    ...suspensions.slice(0, 60).map((s, i) => ({ organizationId: org._id, recipientClubId: s.clubId, type: s.status === 'PROVISIONAL' ? 'RED_CARD_DECISION_REQUIRED' : 'SUSPENSION_SERVED', subject: s.status === 'PROVISIONAL' ? 'Décision de carton rouge en attente' : 'Suspension purgée', body: s.status === 'PROVISIONAL' ? 'Une suspension provisoire est active dans l’attente de la décision.' : 'Le joueur a purgé sa suspension automatique.', dedupeKey: `SEED-SUSPENSION-${s._id}`, entityType: 'Suspension', entityId: s._id, read: i % 3 === 0 })),
    ...matches.filter(m => m.homologue).slice(-32).map((m, i) => ({ organizationId: org._id, recipientClubId: i % 2 ? m.homeClubId : m.awayClubId, type: 'MATCH_FINALIZED', subject: 'Résultat homologué', body: `Le résultat de la journée ${m.journee} est officiel.`, dedupeKey: `SEED-MATCH-${m._id}-${i % 2}`, entityType: 'Match', entityId: m._id, read: i % 4 === 0 })),
  ]);
  await AuditLog.insertMany(matches.filter(m => m.homologue).slice(-80).map((m, i) => ({ organizationId: org._id, actorUserId: admin._id, actorRole: 'FTF_ADMIN', action: 'MATCH_FINALIZED', entityType: 'Match', entityId: m._id, after: { journee: m.journee, scoreHome: m.scoreHome, scoreAway: m.scoreAway }, requestId: `seed-${String(i + 1).padStart(4, '0')}`, createdAt: m.dateValidation })));

  const counts = { clubs: clubs.length, joueurs: players.length, staff: clubs.length * 3, arbitres: referees.length, journees: rounds.length, matchs: matches.length, homologues: matches.filter(m => m.homologue).length, cartes: cards.length, suspensions: suspensions.length };
  console.log('Seed terminé avec succès:', counts);
  console.log('Admin: admin@ftf.tn / Admin@123');
  console.log('Clubs: <code>@club.ftf.tn / Club@123 (exemple: est@club.ftf.tn)');
}

seed().catch(error => { console.error('Échec du seed:', error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
