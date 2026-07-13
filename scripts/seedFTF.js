// scripts/seedFTF.js

/**
 * Seed script for FTF 2025‑2026 synthetic data.
 *
 * - Deletes all collections (clubs, joueurs, matches, disciplinary cards, suspensions, standings, etc.).
 * - Inserts a sample competition, season, 4 clubs with generated logos, 8 players, a double‑round‑robin schedule,
 *   match results, and a few disciplinary events to exercise the discipline engine.
 * - Uses the existing Mongoose models from the project.
 */

import mongoose from 'mongoose';
import connectDB from '../lib/db';
import Club from '../lib/models/Club';
import Joueur from '../lib/models/Joueur';
import Competition from '../lib/models/Competition';
import Saison from '../lib/models/Saison';
import Match from '../lib/models/Match';
import DisciplinaryCard from '../lib/models/DisciplinaryCard';
import Suspension from '../lib/models/Suspension';
import Standings from '../lib/models/Standings';

const ORGANIZATION_ID = new mongoose.Types.ObjectId(); // synthetic org

async function clearAll() {
  const collections = [
    'clubs',
    'joueurs',
    'competitions',
    'saisons',
    'matches',
    'disciplinarycards',
    'suspensions',
    'standings',
    'suspensionserviceentries',
    'notifications',
    'disciplinaryrulesets',
  ];
  for (const name of collections) {
    try {
      await mongoose.connection.collection(name).deleteMany({});
    } catch (e) {
      console.warn(`Collection ${name} not found or could not be cleared:`, e.message);
    }
  }
}

async function seed() {
  // 1. Organization placeholder – models reference organizationId, already defined above.

  // 2. Create clubs
  const clubData = [
    { name: 'Club Alpha', code: 'ALP', logoPath: 'club_a_logo.png' },
    { name: 'Club Beta', code: 'BET', logoPath: 'club_b_logo.png' },
    { name: 'Club Gamma', code: 'GAM', logoPath: 'club_c_logo.png' },
    { name: 'Club Delta', code: 'DEL', logoPath: 'club_d_logo.png' },
  ];
  const clubs = await Club.insertMany(
    clubData.map((c) => ({
      organizationId: ORGANIZATION_ID,
      nom: c.name,
      code: c.code,
      logoUrl: `https://ftf-livid.vercel.app/assets/${c.logoPath}`,
    }))
  );

  // 3. Create players (2 per club)
  const joueurs = [];
  for (const club of clubs) {
    for (let i = 1; i <= 2; i++) {
      const joueur = new Joueur({
        organizationId: ORGANIZATION_ID,
        clubId: club._id,
        nom: `Joueur${i}-${club.code}`,
        prenom: `Prenom${i}`,
        numeroMaillot: i,
        actif: true,
      });
      await joueur.save();
      joueurs.push(joueur);
    }
  }

  // 4. Competition & season
  const competition = await Competition.create({
    organizationId: ORGANIZATION_ID,
    nom: 'Championnat National 2025‑2026',
    type: 'LEAGUE',
    debut: new Date('2025-09-01'),
    fin: new Date('2026-06-30'),
  });

  const saison = await Saison.create({
    organizationId: ORGANIZATION_ID,
    competitionId: competition._id,
    annee: '2025‑2026',
    debut: competition.debut,
    fin: competition.fin,
  });

  // 5. Generate a simple double round‑robin schedule (each pair plays twice)
  const matches = [];
  const dates = [];
  const startDate = new Date('2025-09-05');
  for (let d = 0; d < 12; d++) {
    // 12 match days, each day 2 matches (4 clubs)
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + d * 7);
    dates.push(date);
  }

  const pairings = [
    [clubs[0], clubs[1]],
    [clubs[2], clubs[3]],
    [clubs[0], clubs[2]],
    [clubs[1], clubs[3]],
    [clubs[0], clubs[3]],
    [clubs[1], clubs[2]],
  ];

  let matchIdx = 0;
  for (const round of pairings) {
    const [home, away] = round;
    const match = await Match.create({
      organizationId: ORGANIZATION_ID,
      competitionId: competition._id,
      saisonId: saison._id,
      roundId: null,
      homeClubId: home._id,
      awayClubId: away._id,
      date: dates[matchIdx % dates.length],
      isOfficial: true,
      statut: 'Programmé',
      homologue: false,
      scoreHome: Math.floor(Math.random() * 4),
      scoreAway: Math.floor(Math.random() * 4),
      evenements: [],
    });
    matches.push(match);
    matchIdx++;
  }

  // 6. Add a few disciplinary events to showcase the engine
  // Pick a random match and give a yellow to a random player
  const targetMatch = matches[0];
  const randomPlayer = joueurs[0];
  targetMatch.evenements.push({
    type: 'Carton Jaune',
    joueurId: randomPlayer._id,
    equipe: 'home',
    minute: 23,
  });
  // Add a direct red to another player
  const redPlayer = joueurs[1];
  targetMatch.evenements.push({
    type: 'Carton Rouge',
    joueurId: redPlayer._id,
    equipe: 'away',
    minute: 70,
  });
  await targetMatch.save();

  console.log('✅ Synthetic data seeded');
}

(async () => {
  try {
    await connectDB();
    await clearAll();
    await seed();
    await mongoose.disconnect();
  } catch (err) {
    console.error('⚠️ Seed script error:', err);
    process.exit(1);
  }
})();
