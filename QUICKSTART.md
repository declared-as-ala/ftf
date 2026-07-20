# QUICKSTART.md — Guide de Démarrage Développeur (FTF Platform)

Ce document décrit comment configurer rapidement un environnement de développement local pour exécuter l'application et lancer les tests.

---

## 🛠️ Configuration de l'environnement local

### 1. Installer Node.js et Docker
* Assurez-vous d'avoir **Node.js 20+** installé localement.
* Assurez-vous d'avoir **Docker** en cours d'exécution.

### 2. Cloner le projet et installer les dépendances
```bash
git clone <repo-url> ftf
cd ftf
npm install
```

### 3. Configurer les variables d'environnement locales
Copiez le fichier d'exemple pour créer la configuration de développement :
```bash
cp .env.example .env.local
```
Ouvrez `.env.local` et assurez-vous qu'il contient :
```ini
MONGODB_URI=mongodb://127.0.0.1:27017/ftf?replicaSet=rs0
NEXTAUTH_SECRET=secret-dev-random-key-32-chars
NEXTAUTH_URL=http://localhost:3000
```

### 4. Démarrer MongoDB localement avec Replica Set
Pour le développement local, démarrez uniquement le service de base de données MongoDB en replica set à l'aide de Docker Compose :
```bash
docker compose up -d mongodb
```
*Note : Docker lancera MongoDB et exécutera automatiquement le script d'initialisation du replica set mono-nœud `rs0` via son healthcheck.*

---

## 🚀 Lancer l'Application

### 1. Initialiser et peupler la base de données
Exécutez le script de seeding pour vider la base locale et injecter des données fictives complètes (16 clubs, 384 joueurs, 240 matchs) :
```bash
npm run seed
```
Le seed génère des blasons de clubs locaux et des photos de joueurs en format SVG, puis les écrit dans `public/uploads/`. Il affiche également les identifiants de test à l'écran.

### 2. Démarrer le serveur de développement
```bash
npm run dev
```
Ouvrez l'application sur [http://localhost:3000](http://localhost:3000).

* **FTF Admin** : Connectez-se avec `admin@ftf.org.tn` / `Admin123!` (ou les identifiants générés par le seed).
* **Club Admin** : Connectez-vous avec `est@est.org.tn` / `Club123!` (pour l'Espérance de Tunis).

---

## 🧪 Exécuter les Tests

### 1. Tests Unitaires & Intégration (Vitest)
Les tests d'intégration se connectent automatiquement à une instance MongoDB en mémoire (`mongodb-memory-server`) et n'affectent pas votre base de données locale.
```bash
# Lancer les tests une seule fois
npm run test

# Lancer en mode watch (développement interactif)
npx vitest
```

### 2. Tests de bout en bout (Playwright)
Les tests E2E simulent des actions utilisateur dans un navigateur (login, navigation, ajout d'événements).
```bash
# Installer les navigateurs requis par Playwright
npx playwright install --with-deps chromium

# Lancer les tests E2E (le serveur local doit tourner en parallèle)
npx playwright test
```

---

## 🏗️ Validation du code avant soumission

Avant de pousser vos modifications sur GitHub, assurez-vous que le projet compile et ne comporte pas d'erreur de typage :
```bash
# Vérification TypeScript sans build
npx tsc --noEmit

# Vérification du linter ESLint
npm run lint
```
Ces vérifications sont exécutées automatiquement lors de chaque Pull Request sur le dépôt via le pipeline GitHub Actions ([ci.yml](file:///c:/Users/Ala/Desktop/ftf/.github/workflows/ci.yml)).
