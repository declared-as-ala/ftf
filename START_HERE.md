# START_HERE.md — Guide de Démarrage Rapide (FTF Platform)

Bienvenue sur la plateforme SaaS de gestion des compétitions et de la discipline de la **Fédération Tunisienne de Football (FTF)**.

Ce document vous guide pas à pas pour comprendre le fonctionnement global de la plateforme, le rôle des différents utilisateurs, et comment naviguer dans la documentation technique.

---

## 🗺️ Cartographie de la Documentation

Pour toute information spécifique, veuillez consulter les fichiers suivants dans le dossier `docs/` :

1. **[product-specification.md](file:///c:/Users/Ala/Desktop/ftf/docs/product-specification.md)** : Spécification fonctionnelle complète de la plateforme (règles métier, pages, permissions).
2. **[disciplinary-rules-sources.md](file:///c:/Users/Ala/Desktop/ftf/docs/disciplinary-rules-sources.md)** : Trace des articles réglementaires officiels du Code Disciplinaire de la FTF (cartons, suspensions, reports).
3. **[database.md](file:///c:/Users/Ala/Desktop/ftf/docs/database.md)** : Modèles de données MongoDB / Mongoose, index et guide de migration.
4. **[api.md](file:///c:/Users/Ala/Desktop/ftf/docs/api.md)** : Description des routes API exposées (admin et club) et des services applicatifs.
5. **[deployment.md](file:///c:/Users/Ala/Desktop/ftf/docs/deployment.md)** : Instructions de déploiement en production (Docker, variables d'environnement, sécurité).
6. **[backup-and-restore.md](file:///c:/Users/Ala/Desktop/ftf/docs/backup-and-restore.md)** : Guide technique pour les sauvegardes de la base de données et des uploads.

---

## 🔄 Flux d'Onboarding & Rôles

L'application gère uniquement **deux rôles** utilisateurs :

### 1. Administrateur FTF (`FTF_ADMIN`)
L'administrateur de la fédération contrôle l'ensemble des données sportives de l'organisation. Son cycle de travail classique est le suivant :
1. **Initialisation** : Création d'une nouvelle saison $\rightarrow$ Activation $\rightarrow$ Création des compétitions et association des règlements de discipline.
2. **Clubs & Comptes** : Enregistrement des clubs $\rightarrow$ Association des clubs aux compétitions $\rightarrow$ Invitation des comptes d'administration des clubs (`CLUB_ADMIN`).
3. **Joueurs** : Import de masse des joueurs par fichier CSV pour chaque club.
4. **Calendrier** : Génération automatique du calendrier de matchs par journée (via l'algorithme Berger).
5. **Saisie des scores** : Après chaque journée jouée, saisie en masse des résultats, buteurs et cartons.
6. **Homologation** : Finalisation officielle de chaque match pour déclencher les calculs automatiques de discipline (suspensions de cartons jaunes et cartons rouges).

### 2. Administrateur Club (`CLUB_ADMIN`)
Le club dispose d'un **accès en lecture seule** strictement limité aux données de son propre club et aux classements de ses compétitions :
* Visualisation de l'effectif des joueurs et de leur éligibilité en temps réel.
* Suivi des cartons reçus et du registre de purge de chaque suspension.
* Consultation du calendrier de matchs, résultats, classements et notifications officielles émises par la FTF.

---

## 🚀 Prochaines Étapes pour Démarrer

* **Si vous êtes développeur** : Rendez-vous sur le fichier **[QUICKSTART.md](file:///c:/Users/Ala/Desktop/ftf/QUICKSTART.md)** pour configurer votre environnement local et exécuter les tests.
* **Si vous êtes administrateur système** : Lisez **[INSTALLATION.md](file:///c:/Users/Ala/Desktop/ftf/INSTALLATION.md)** pour déployer l'application sur un serveur.
* **Si vous êtes utilisateur final** :
  * Guide de l'administrateur fédéral : **[user-guide-admin.md](file:///c:/Users/Ala/Desktop/ftf/docs/user-guide-admin.md)**.
  * Guide du club de football : **[user-guide-club.md](file:///c:/Users/Ala/Desktop/ftf/docs/user-guide-club.md)**.
