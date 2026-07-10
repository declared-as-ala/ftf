import dotenv from 'dotenv';
import path from 'path';

// Charger .env.local avant tout import
const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// Vérifier que MONGODB_URI est chargé
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI non trouvé dans .env.local');
  process.exit(1);
}

// Garde-fou : le seed EFFACE toute la base. Interdit en production, --force requis ailleurs.
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Seed refusé : NODE_ENV=production. Le seed efface toute la base de données.');
  process.exit(1);
}

if (!process.argv.includes('--force')) {
  console.error('⚠️  Le seed va EFFACER toutes les données existantes.');
  console.error('    Pour confirmer, relancez avec : npm run seed -- --force');
  process.exit(1);
}

console.log('🔗 URI MongoDB:', process.env.MONGODB_URI ? '✅ Configuré' : '❌ Non configuré');

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../lib/db';
import User from '../lib/models/User';
import Club from '../lib/models/Club';
import Joueur from '../lib/models/Joueur';
import Staff from '../lib/models/Staff';
import Saison from '../lib/models/Saison';
import Competition from '../lib/models/Competition';
import Match from '../lib/models/Match';
import Discipline from '../lib/models/Discipline';
import Arbitre from '../lib/models/Arbitre';
import Organization from '../lib/models/Organization';
import DisciplinaryRuleSet from '../lib/models/DisciplinaryRuleSet';

async function seed() {
  console.log('🌱 Début du seeding...');
  
  // S'assurer que l'URI est bien chargée
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI n\'est pas défini. Vérifiez votre fichier .env.local');
  }
  console.log('🔗 Connexion à MongoDB Atlas...');

  await connectDB();

  // Nettoyer la base de données
  console.log('🧹 Nettoyage de la base de données...');
  await Promise.all([
    User.deleteMany({}),
    Club.deleteMany({}),
    Joueur.deleteMany({}),
    Staff.deleteMany({}),
    Saison.deleteMany({}),
    Competition.deleteMany({}),
    Match.deleteMany({}),
    Discipline.deleteMany({}),
    Arbitre.deleteMany({}),
    Organization.deleteMany({}),
    DisciplinaryRuleSet.deleteMany({}),
  ]);

  // Créer l'organisation FTF
  console.log('🏢 Création de l\'organisation...');
  const org = await Organization.create({
    name: 'Fédération Tunisienne de Football',
    code: 'FTF',
    type: 'FEDERATION',
    active: true,
  });

  // Créer la saison actuelle
  console.log('📅 Création de la saison...');
  const saison = await Saison.create({
    organizationId: org._id,
    nom: 'Saison 2024-2025',
    code: 'SAISON_2024_2025',
    anneeDebut: 2024,
    anneeFin: 2025,
    dateDebut: new Date('2024-09-01'),
    dateFin: new Date('2025-05-31'),
    active: true,
    status: 'ACTIVE',
    isCurrent: true,
    configuration: {
      seuilCartonsJaunes: 3,
      suspensionCartonRouge: 1,
      suspensionStaff: 1,
    },
  });

  // Créer l'utilisateur ADMIN
  console.log('👤 Création de l\'administrateur...');
  const hashedAdminPassword = await bcrypt.hash('Admin@123', 10);
  const adminUser = await User.create({
    organizationId: org._id,
    email: 'admin@ftf.tn',
    password: hashedAdminPassword,
    name: 'Administrateur FTF',
    role: 'FTF_ADMIN',
    status: 'ACTIVE',
  });

  // Créer les clubs (6 clubs tunisiens réalistes)
  console.log('🏛️ Création des clubs...');
  const clubsData = [
    {
      nom: 'Espérance Sportive de Tunis',
      logo: '/uploads/clubs/est.png',
      stade: 'Stade Olympique de Radès',
      ville: 'Tunis',
      couleurs: ['Rouge', 'Jaune'],
      fondation: 1919,
      emailOfficiel: 'contact@est.tn',
      description: 'Club le plus titré de Tunisie',
      capaciteStade: 60000,
      siteweb: 'https://www.est.tn',
      telephone: '+216 71 123 456',
    },
    {
      nom: 'Club Africain',
      logo: '/uploads/clubs/ca.png',
      stade: 'Stade Olympique de Radès',
      ville: 'Tunis',
      couleurs: ['Blanc', 'Rouge'],
      fondation: 1920,
      emailOfficiel: 'contact@clubafricain.tn',
      description: 'Le Doyen du football tunisien',
      capaciteStade: 60000,
      siteweb: 'https://www.clubafricain.tn',
      telephone: '+216 71 654 321',
    },
    {
      nom: 'Étoile Sportive du Sahel',
      logo: '/uploads/clubs/ess.png',
      stade: 'Stade Olympique de Sousse',
      ville: 'Sousse',
      couleurs: ['Rouge', 'Blanc'],
      fondation: 1925,
      emailOfficiel: 'contact@ess.tn',
      description: 'L\'Étoile du Sahel',
      capaciteStade: 25000,
      siteweb: 'https://www.ess.tn',
      telephone: '+216 73 123 456',
    },
    {
      nom: 'Union Sportive Monastirienne',
      logo: '/uploads/clubs/usm.png',
      stade: 'Stade Mustapha Ben Jannet',
      ville: 'Monastir',
      couleurs: ['Bleu', 'Blanc'],
      fondation: 1944,
      emailOfficiel: 'contact@usm.tn',
      description: 'Les Aigles de Monastir',
      capaciteStade: 20000,
      siteweb: 'https://www.usm.tn',
      telephone: '+216 73 654 321',
    },
    {
      nom: 'Club Sportif Sfaxien',
      logo: '/uploads/clubs/css.png',
      stade: 'Stade Taïeb Mhiri',
      ville: 'Sfax',
      couleurs: ['Bleu', 'Jaune'],
      fondation: 1928,
      emailOfficiel: 'contact@css.tn',
      description: 'Les Aigles de Sfax',
      capaciteStade: 18000,
      siteweb: 'https://www.css.tn',
      telephone: '+216 74 123 456',
    },
    {
      nom: 'Stade Tunisien',
      logo: '/uploads/clubs/st.png',
      stade: 'Stade Chedli Zouiten',
      ville: 'Tunis',
      couleurs: ['Vert', 'Blanc'],
      fondation: 1948,
      emailOfficiel: 'contact@stade-tunisien.tn',
      description: 'Le Stade Tunisien',
      capaciteStade: 15000,
      siteweb: 'https://www.stade-tunisien.tn',
      telephone: '+216 71 789 012',
    },
  ];

  const clubs = [];
  const clubCodes = ['EST', 'CA', 'ESS', 'USM', 'CSS', 'ST'];
  for (let idx = 0; idx < clubsData.length; idx++) {
    const data = clubsData[idx];
    const club = await Club.create({
      ...data,
      organizationId: org._id,
      code: clubCodes[idx] || data.nom.substring(0, 3).toUpperCase(),
      slug: data.nom.toLowerCase().replace(/\s+/g, '-'),
      shortName: data.nom.split(' ').slice(0, 2).join(' '),
      status: 'ACTIVE',
    });
    clubs.push(club);
  }

  // Créer les utilisateurs des clubs
  console.log('👥 Création des utilisateurs clubs...');
  const hashedClubPassword = await bcrypt.hash('Club@123', 10);
  const clubUsers = [];
  for (let i = 0; i < clubs.length; i++) {
    const clubUser = await User.create({
      organizationId: org._id,
      email: `club${i + 1}@club.tn`,
      password: hashedClubPassword,
      name: `Admin ${clubs[i].nom}`,
      role: 'CLUB_ADMIN',
      status: 'ACTIVE',
      clubId: clubs[i]._id,
    });
    clubUsers.push(clubUser);
  }

  // Créer les joueurs pour chaque club
  console.log('⚽ Création des joueurs...');
  const nationalites = ['Tunisie', 'France', 'Algérie', 'Maroc', 'Sénégal', 'Côte d\'Ivoire'];
  const prenoms = ['Mohamed', 'Ahmed', 'Ali', 'Youssef', 'Karim', 'Amine', 'Hamza', 'Omar', 'Sami', 'Firas', 'Anis', 'Rami', 'Walid', 'Mehdi', 'Nizar', 'Khalil', 'Bilel', 'Hichem', 'Aymen', 'Saif'];
  const noms = ['Ben Salem', 'Traoré', 'Gharbi', 'Kouki', 'Ayari', 'Msakni', 'Khalil', 'Badri', 'Chaalali', 'Khenissi', 'Akaichi', 'Dhaouadi', 'Maaloul', 'Drager', 'Laabidi', 'Romdhane', 'Sliti', 'Jaziri', 'Belkebla', 'Machach'];

  const allJoueurs = [];
  for (let clubIndex = 0; clubIndex < clubs.length; clubIndex++) {
    const club = clubs[clubIndex];
    const clubJoueurs = [];
    for (let i = 0; i < 22; i++) {
      const position = i === 0 || i === 1 ? 'Gardien' : 
                      i < 8 ? 'Défenseur' : 
                      i < 15 ? 'Milieu' : 'Attaquant';
      
      // Générer un préfixe unique pour chaque club
      const clubPrefix = club.nom
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Z]/g, '') || club.nom.substring(0, 3).toUpperCase();
      
      const lastName = noms[(clubIndex * 22 + i) % noms.length];
      const firstName = prenoms[(clubIndex * 22 + i) % prenoms.length];

      const joueur = await Joueur.create({
        organizationId: org._id,
        nom: lastName,
        prenom: firstName,
        displayName: `${firstName} ${lastName}`,
        licence: `${clubPrefix}${2024}${String(clubIndex + 1).padStart(2, '0')}${String(i + 1).padStart(2, '0')}`,
        nationalite: nationalites[Math.floor(Math.random() * nationalites.length)],
        position,
        clubId: club._id,
        dateNaissance: new Date(1995 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        numeroMaillot: i + 1,
        taille: 170 + Math.floor(Math.random() * 20),
        poids: 70 + Math.floor(Math.random() * 15),
        piedPrefere: Math.random() > 0.5 ? 'Droit' : 'Gauche',
        category: 'Sénior',
        status: 'ACTIVE',
        stats: {
          matchsJoues: Math.floor(Math.random() * 30),
          buts: position === 'Attaquant' ? Math.floor(Math.random() * 15) : Math.floor(Math.random() * 5),
          passes: Math.floor(Math.random() * 10),
          cartonsJaunes: Math.floor(Math.random() * 5),
          cartonsRouges: Math.random() > 0.8 ? 1 : 0,
        },
        licenceValide: true,
      });
      clubJoueurs.push(joueur);
      allJoueurs.push(joueur);
    }
  }

  // Créer le staff pour chaque club
  console.log('👔 Création du staff...');
  const allStaff = [];
  const staffNames = [
    { nom: 'Benzarti', prenom: 'Faouzi' },
    { nom: 'Kouki', prenom: 'Alexandre' },
    { nom: 'Mkacher', prenom: 'Skander' },
    { nom: 'Chaabani', prenom: 'Maher' },
    { nom: 'Ben Youssef', prenom: 'Sami' },
    { nom: 'Trabelsi', prenom: 'Radhi' },
  ];

  for (let i = 0; i < clubs.length; i++) {
    const club = clubs[i];
    const staffData = staffNames[i % staffNames.length];
    
    // Entraîneur Principal
    const coach = await Staff.create({
      nom: staffData.nom,
      prenom: staffData.prenom,
      type: 'Entraîneur Principal',
      clubId: club._id,
      dateNaissance: new Date(1970 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      nationalite: 'Tunisie',
      certifications: [
        {
          type: 'CAF A',
          dateObtention: new Date(2010, 1, 1),
          organisme: 'CAF',
        },
      ],
      licenceValide: true,
    });
    allStaff.push(coach);

    // Entraîneur Adjoint
    const adjoint = await Staff.create({
      nom: staffNames[(i + 1) % staffNames.length].nom,
      prenom: staffNames[(i + 1) % staffNames.length].prenom,
      type: 'Entraîneur Adjoint',
      clubId: club._id,
      dateNaissance: new Date(1975 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      nationalite: 'Tunisie',
      certifications: [
        {
          type: 'CAF B',
          dateObtention: new Date(2012, 3, 1),
          organisme: 'CAF',
        },
      ],
      licenceValide: true,
    });
    allStaff.push(adjoint);

    // Préparateur Physique
    const prepPhysique = await Staff.create({
      nom: `Coach${i + 1}`,
      prenom: 'Physique',
      type: 'Préparateur Physique',
      clubId: club._id,
      dateNaissance: new Date(1980, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      nationalite: 'Tunisie',
      licenceValide: true,
    });
    allStaff.push(prepPhysique);
  }

  // Créer quelques arbitres
  console.log('⚖️ Création des arbitres...');
  const arbitres = [];
  const arbitreNames = [
    { nom: 'Jemli', prenom: 'Sadok' },
    { nom: 'Ben Brahim', prenom: 'Youssef' },
    { nom: 'Khelifi', prenom: 'Mehdi' },
    { nom: 'Bouslama', prenom: 'Amine' },
  ];

  for (const arbName of arbitreNames) {
    const arbitre = await Arbitre.create({
      organizationId: org._id,
      nom: arbName.nom,
      prenom: arbName.prenom,
      categorie: 'Élite',
      dateNaissance: new Date(1985 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      nationalite: 'Tunisie',
      ville: ['Tunis', 'Sfax', 'Sousse', 'Monastir'][Math.floor(Math.random() * 4)],
      certifications: [
        {
          type: 'FIFA',
          dateObtention: new Date(2015, 1, 1),
        },
      ],
      actif: true,
    });
    arbitres.push(arbitre);
  }

  // Créer un règlement disciplinaire
  console.log('⚖️ Création du règlement disciplinaire...');
  const ruleset = await DisciplinaryRuleSet.create({
    organizationId: org._id,
    seasonId: saison._id,
    name: 'Règlement Disciplinaire - Saison 2024-2025',
    version: 1,
    yellowCardThreshold: 3,
    yellowCardSuspensionMatches: 1,
    yellowCardsCountOnlyOfficialMatches: true,
    clearUnusedYellowCardsAtSeasonEnd: true,
    redCardCreatesProvisionalSuspension: true,
    suspensionScope: 'ALL_OFFICIAL_COMPETITIONS',
    friendlyMatchesCount: false,
    effectiveFrom: saison.dateDebut,
    effectiveTo: saison.dateFin,
    active: true,
  });

  // Créer une compétition
  console.log('🏆 Création de la compétition...');
  const competition = await Competition.create({
    organizationId: org._id,
    nom: 'Ligue 1 Professionnelle',
    code: 'L1_PRO',
    type: 'Championnat',
    niveau: 'National',
    saisonId: saison._id,
    dateDebut: new Date('2024-09-15'),
    dateFin: new Date('2025-05-20'),
    clubsParticipants: clubs.map(c => c._id),
    formatCompetition: 'Championnat',
    reglementPoints: {
      victoire: 3,
      nul: 1,
      defaite: 0,
    },
    active: true,
    status: 'ACTIVE',
    isOfficial: true,
    tieBreakers: ['POINTS', 'GOAL_DIFFERENCE', 'GOALS_SCORED'],
    disciplinaryRuleSetId: ruleset._id,
  });

  // Créer des matchs (terminés et programmés)
  console.log('📅 Création des matchs...');
  const matches = [];
  const today = new Date();
  const startDate = new Date('2024-09-15');

  // Matchs terminés (Journées 1-10)
  for (let journee = 1; journee <= 10; journee++) {
    const matchDate = new Date(startDate);
    matchDate.setDate(startDate.getDate() + (journee - 1) * 7);
    matchDate.setHours(18 + Math.floor(Math.random() * 3), 0, 0, 0);

    // Créer plusieurs matchs par journée
    const shuffledClubs = [...clubs].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.floor(clubs.length / 2); i++) {
      const homeClub = shuffledClubs[i * 2];
      const awayClub = shuffledClubs[i * 2 + 1];
      
      const homeJoueurs = allJoueurs.filter(j => j.clubId.toString() === homeClub._id.toString());
      const awayJoueurs = allJoueurs.filter(j => j.clubId.toString() === awayClub._id.toString());
      
      const scoreHome = Math.floor(Math.random() * 4);
      const scoreAway = Math.floor(Math.random() * 4);
      
      const evenements = [];
      
      // Ajouter des buts
      for (let g = 0; g < scoreHome; g++) {
        evenements.push({
          type: 'But',
          minute: 15 + g * 20 + Math.floor(Math.random() * 10),
          joueurId: homeJoueurs[Math.floor(Math.random() * homeJoueurs.length)]._id,
          equipe: 'home',
          description: ['But de la tête', 'Penalty', 'But sur contre-attaque', 'Frappe lointaine'][Math.floor(Math.random() * 4)],
        });
      }
      
      for (let g = 0; g < scoreAway; g++) {
        evenements.push({
          type: 'But',
          minute: 20 + g * 25 + Math.floor(Math.random() * 10),
          joueurId: awayJoueurs[Math.floor(Math.random() * awayJoueurs.length)]._id,
          equipe: 'away',
          description: ['But de la tête', 'Penalty', 'But sur contre-attaque', 'Frappe lointaine'][Math.floor(Math.random() * 4)],
        });
      }
      
      // Ajouter quelques cartons
      if (Math.random() > 0.3) {
        evenements.push({
          type: 'Carton Jaune',
          minute: 30 + Math.floor(Math.random() * 50),
          joueurId: homeJoueurs[Math.floor(Math.random() * homeJoueurs.length)]._id,
          equipe: 'home',
          description: 'Faute tactique',
        });
      }
      
      if (Math.random() > 0.5) {
        evenements.push({
          type: 'Carton Jaune',
          minute: 40 + Math.floor(Math.random() * 40),
          joueurId: awayJoueurs[Math.floor(Math.random() * awayJoueurs.length)]._id,
          equipe: 'away',
          description: 'Faute tactique',
        });
      }

      evenements.sort((a, b) => a.minute - b.minute);

      const match = await Match.create({
        organizationId: org._id,
        saisonId: saison._id,
        competitionId: competition._id,
        journee,
        homeClubId: homeClub._id,
        awayClubId: awayClub._id,
        date: matchDate,
        stade: homeClub.stade,
        scoreHome: scoreHome,
        scoreAway: scoreAway,
        statut: 'Terminé',
        arbitrePrincipalId: arbitres[Math.floor(Math.random() * arbitres.length)]._id,
        evenements,
        homologue: true,
        spectateurs: Math.floor(Math.random() * 30000) + 5000,
        public: true,
      });
      matches.push(match);
    }
  }

  // Matchs programmés (Journées 11-15)
  for (let journee = 11; journee <= 15; journee++) {
    const matchDate = new Date(today);
    matchDate.setDate(today.getDate() + (journee - 11) * 7);
    matchDate.setHours(18 + Math.floor(Math.random() * 3), 0, 0, 0);

    const shuffledClubs = [...clubs].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.floor(clubs.length / 2); i++) {
      const homeClub = shuffledClubs[i * 2];
      const awayClub = shuffledClubs[i * 2 + 1];

      const match = await Match.create({
        organizationId: org._id,
        saisonId: saison._id,
        competitionId: competition._id,
        journee,
        homeClubId: homeClub._id,
        awayClubId: awayClub._id,
        date: matchDate,
        stade: homeClub.stade,
        scoreHome: 0,
        scoreAway: 0,
        statut: 'Programmé',
        arbitrePrincipalId: arbitres[Math.floor(Math.random() * arbitres.length)]._id,
        evenements: [],
        public: true,
      });
      matches.push(match);
    }
  }

  console.log('✅ Seeding terminé avec succès !');
  console.log('\n📊 Résumé :');
  console.log(`- 1 Admin créé (admin@ftf.tn / Admin@123)`);
  console.log(`- ${clubs.length} Clubs créés`);
  for (let i = 0; i < clubs.length; i++) {
    console.log(`  • Club ${i + 1}: club${i + 1}@club.tn / Club@123`);
  }
  console.log(`- ${allJoueurs.length} Joueurs créés`);
  console.log(`- ${allStaff.length} Staff créés`);
  console.log(`- 1 Saison active créée`);
  console.log(`- 1 Compétition créée`);
  console.log(`- ${matches.length} Match(s) créé(s) (${matches.filter(m => m.statut === 'Terminé').length} terminés, ${matches.filter(m => m.statut === 'Programmé').length} programmés)`);
  console.log(`- ${arbitres.length} Arbitre(s) créé(s)`);

  await mongoose.connection.close();
  console.log('\n🔌 Déconnexion de MongoDB');
}

seed().catch((error) => {
  console.error('❌ Erreur lors du seeding:', error);
  process.exit(1);
});
