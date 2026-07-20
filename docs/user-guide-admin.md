# Guide d'Utilisation de l'Administrateur FTF (`/admin`)

Ce guide explique comment utiliser le portail d'administration de la Fédération Tunisienne de Football pour gérer les compétitions et les sanctions disciplinaires.

---

## 🛠️ 1. Initialisation d'une Saison et des Compétitions

L'onboarding sur la plateforme suit une hiérarchie stricte.

### Créer et Activer une Saison
1. Naviguez vers **Saisons** dans la barre latérale.
2. Cliquez sur **Créer une Saison** et définissez :
   * Le nom (ex: *Saison 2025-2026*).
   * Les dates de début et de fin.
   * La configuration par défaut de la discipline (ex: seuil de cartons jaunes $\rightarrow$ 3, match de suspension automatique $\rightarrow$ 1).
3. Une fois créée, cliquez sur **Activer** sur la fiche de la saison pour la définir comme saison courante de l'organisation.

### Créer une Compétition
1. Naviguez vers **Compétitions** et cliquez sur **Créer une Compétition**.
2. Renseignez le nom, le type (Championnat/Coupe) et associez-la à la saison active. Le règlement de discipline de la saison sera automatiquement hérité.

---

## 👥 2. Gestion des Clubs et Imports de Joueurs

### Enregistrer des Clubs
1. Allez sur **Clubs** $\rightarrow$ **Nouveau Club**.
2. Saisissez les données (Nom, code unique, stade par défaut, e-mail officiel).
3. Dans l'onglet **Compétitions** de la fiche Compétition, inscrivez les clubs participants.

### Importer l'Effectif des Joueurs (CSV)
1. Allez sur **Imports**.
2. Téléchargez le modèle CSV pour **Joueurs**.
3. Remplissez le fichier avec les licences des joueurs, leurs dates de naissance et positions.
4. Sélectionnez le fichier, cliquez sur **Valider & Aperçu** pour voir les erreurs de format ou de club inexistant.
5. Si tout est correct, cliquez sur **Confirmer l'import**.

---

## 📅 3. Génération du Calendrier et Journées

### Planifier les Rencontres (Journées)
1. Sur la fiche de votre compétition, allez sur l'onglet **Journées**.
2. Cliquez sur **Générer le Calendrier**.
3. Choisissez le format (Aller Simple ou Aller-Retour). L'algorithme Berger va générer l'ensemble des rencontres automatiquement sans aucun conflit de date ou de doublon de club.
4. Si vous devez ajuster un match (date, heure ou stade), cliquez sur le match puis sur **Modifier le match**.

---

## ⚽ 4. Saisie des Scores et Finalisation (Homologation)

### Saisie en masse par Journée
1. Allez sur **Compétitions** $\rightarrow$ sélectionnez la compétition $\rightarrow$ onglet **Journées** $\rightarrow$ cliquez sur la journée en cours.
2. Vous accédez à la **Grille des rencontres** de cette journée.
3. Saisissez les scores des matchs en mode brouillon, puis cliquez sur **Enregistrer le brouillon**.
4. Pour chaque match joué, vous pouvez ouvrir le panneau latéral pour ajouter :
   * **Les buteurs** (ex: *Mskani(12)*, le système tentera de lier le but à la fiche joueur).
   * **Les cartons** (Carton Jaune, Carton Rouge, Carton Jaune/Rouge).
   * **Les notes administratives** ou charger la feuille de match signée (PDF/PNG).

### Homologation officielle d'un Match
Tant qu'un match est en état "Brouillon", les cartons et les buts ne comptent pas pour les statistiques officielles et le calcul disciplinaire.
1. Une fois les scores et cartons saisis, cliquez sur **Homologuer** (ou **Homologuer la journée**).
2. **Effets automatiques de l'homologation** :
   * Les points et buts du match sont intégrés dans le **Classement**.
   * Les cartons jaunes sont accumulés sur les fiches des joueurs.
   * Si un joueur atteint **3 cartons jaunes**, le système génère automatiquement une suspension d'un match ferme pour la rencontre officielle suivante et l'affiche sur son profil.
   * Si un joueur reçoit un carton rouge direct, le système crée une suspension provisoire immédiate.

---

## 🟥 5. Décisions Disciplinaires et Suspensions

### Décider du sort d'un Carton Rouge
1. Naviguez vers **Discipline** $\rightarrow$ onglet **Cartons Rouges**.
2. Vous y trouverez la liste des joueurs exclus en cours de suspension provisoire.
3. Cliquez sur **Enregistrer la décision** :
   * Saisissez le nombre de matchs ferme de suspension ordonné par la commission de discipline.
   * Les matchs officiels déjà manqués par le joueur depuis son exclusion sont automatiquement déduits.
   * Le joueur passe en statut de suspension actif pour les rencontres restantes.

### Consulter le Registre Disciplinaire
Le menu **Discipline** regroupe :
* **Cartons Jaunes** : Suivi des joueurs sous le coup d'avertissements et signalement des joueurs **À risque** (ayant 2 cartons jaunes actifs).
* **Suspensions** : Historique et registre de purge (ledger) détaillant précisément pour chaque match joué si la suspension a été décomptée ou non (forfait, report, etc.) avec la justification.
* **Anomalies** : Liste des alertes de participation non réglementaire (ex: un joueur suspendu ayant été notifié buteur ou ayant reçu un carton).
