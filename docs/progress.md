# Progress Tracker

> **How to resume in a new session:** read `CLAUDE.md` (project brief & conventions) → this file (where we stopped) → [implementation-roadmap.md](implementation-roadmap.md) (what's next). The spec lives in [product-specification.md](product-specification.md); the audit in [architecture-audit.md](architecture-audit.md).
>
> **Update protocol — after every batch:** update the table below (status, modified files, date, notes) · tick the roadmap checkboxes · record tests run and remaining issues in the batch log · propose the next batch. Statuses: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked.

## Task table

| Task | Status | Modified files | Date | Notes |
|---|---|---|---|---|
| Full repository audit | ✅ | — (read-only) | 2026-07-10 | Findings in [architecture-audit.md](architecture-audit.md) |
| Project brief (CLAUDE.md) + roadmap seed (NEXTSTEP.md) | ✅ | `CLAUDE.md`, `NEXTSTEP.md` | 2026-07-10 | |
| Documentation phase (10 docs files) | ✅ | `docs/*.md` (10 files), `CLAUDE.md`, `NEXTSTEP.md` | 2026-07-10 | This batch — docs only, zero code changes |
| **Sprint 1.1 — Safe P0 fixes** | ✅ | see Batch 1 log | 2026-07-10 | tsc clean for the first time |
| — Fix `Arbitre.ts` TS bug | ✅ | `lib/models/Arbitre.ts` | 2026-07-10 | `IArbitre` naming |
| — `.env.example` + remove secret/URI fallbacks | ✅ | `.env.example`, `lib/auth.ts`, `lib/db.ts` | 2026-07-10 | Boot fails fast when env missing |
| — Seed production guard | ✅ | `scripts/seed.ts` | 2026-07-10 | Refuses in production; `--force` required to wipe |
| — Login cleanup (demo creds, cookie hack, clear-cookies gate) | ✅ | `app/login/page.tsx`, `app/clear-cookies/page.tsx` | 2026-07-10 | clear-cookies 404s in production |
| — Pre-existing tsc errors (`_id: string` in 12 models, populate typing, tailwind darkMode) | ✅ | `lib/models/*.ts` (12), `lib/auth.ts`, `tailwind.config.ts` | 2026-07-10 | Added in-batch: gate was "tsc clean" |
| — ⚠️ Rotate Atlas creds + NEXTAUTH_SECRET | ⬜ | — | | **User action** — values were exposed in chat (good news: `ftf/` was never in a git repo — no history purge needed) |
| Sprint 1.2 — Upload safety, finalized-match guard, replica set | ✅ | see Batch 2 log | 2026-07-10 | Transactions now possible in dev |
| Sprint 1.3 — Role migration + user hardening | ✅ | see Batch 3 log | 2026-07-10 | Roles `FTF_ADMIN`/`CLUB_ADMIN` live; migration exécutée (1 admin + 6 clubs) |
| Sprint 1.4 — api helpers, zod start, AuditService, test stack, pagination | ✅ | see Batch 4 log | 2026-07-10 | **Phase 1 terminée** — 26 tests verts |
| Phase 2 — Seasons & Competitions | ✅ | see Batch 6 log | 2026-07-10 | **Phase 2 terminée** — CRUD, pages workspace, Stage C live |
| — Sprint 2.1 — Models & organization | ✅ | see Batch 5 log | 2026-07-10 | Organization & RuleSets live; backfills run |
| — Sprint 2.2 — APIs & pages | ✅ | see Batch 6 log | 2026-07-10 | CRUD APIs, workspace shells, checklist enrollments, components |
| Phase 3 — Journées | ✅ | see Batch 7 log | 2026-07-10 | **Phase 3 terminée** — Berger scheduling algorithm, transactional generation, Journées UI tab |
| Phase 4 — Match Results (finalization, standings, result-entry UX) | ✅ | see Batch 8 log | 2026-07-10 | **Phase 4 terminée** — Finalization engine, Standings, result-entry UX |
| Phase 5 — Discipline Engine | ✅ | see Batch 9 log | 2026-07-10 | **Phase 5 terminée** — 58 tests verts ; engine intégré dans la finalisation ; suspendu/joueur → unavailable ; 15 nouveaux tests |
| Phase 6 — Club Portal | ✅ | see Batch 10 log | 2026-07-10 | **Phase 6 terminée** — 69 tests verts; 11 API routes, 10 pages, sidebar mis à jour |
| Phase 7 — Reports, Audit UI, Search, Imports | 🟨 | see Batch 11 log | 2026-07-10 | **Phase 7 partielle** — 69 tests verts; ReportService + reports page, audit page, users CRUD, settings, search API |
| Phase 8 — Production Ready | ⬜ | | | |
| Phase 8 — Realistic large development seed | ✅ | `scripts/seed.ts` | 2026-07-11 | 16 LP1 clubs, 384 players, 30 rounds, 240 matches, discipline/standings/notifications/audit |

## Batch log

### Batch 0 — Documentation & organization (2026-07-10) ✅
- **Created:** `docs/architecture-audit.md`, `docs/product-specification.md`, `docs/database.md`, `docs/api.md`, `docs/security.md`, `docs/testing.md`, `docs/ui-ux.md`, `docs/disciplinary-rules-sources.md`, `docs/implementation-roadmap.md`, `docs/progress.md`
- **Updated:** `CLAUDE.md` (documentation map), `NEXTSTEP.md` (pointer to docs)
- **Tests run:** none applicable (markdown only); verified `git status` shows only markdown changes
- **Remaining issues:** all open items live in the roadmap; live Atlas credentials still need rotation (user action)
- **Next batch proposed:** **Sprint 1.1 — Safe P0 fixes** — fix `Arbitre.ts` TS bug · create `.env.example` · remove fallback secret (`lib/auth.ts`) + localhost URI fallback (`lib/db.ts`) · seed production guard · remove login demo-creds block + cookie hack. Verification: `npx tsc --noEmit` clean, login still works, seed refuses in production mode. Small, independent, testable.

### Batch 1 — Sprint 1.1: Safe P0 fixes (2026-07-10) ✅
- **Modified:** `lib/models/Arbitre.ts` (IArbitre rename + `_id` fix) · `lib/models/{Club,Competition,Discipline,Evenement,Joueur,Licence,Match,Saison,Staff,Transfert,User}.ts` (removed conflicting `_id: string` — Mongoose `Document` provides ObjectId) · `lib/auth.ts` (no fallback secret, fail-fast, typed populated club) · `lib/db.ts` (no localhost fallback, fail-fast) · `scripts/seed.ts` (production refusal + `--force` gate) · `app/login/page.tsx` (removed demo creds + cookie hack) · `app/clear-cookies/page.tsx` (404 in production) · `tailwind.config.ts` (`darkMode: "class"`)
- **Created:** `.env.example`
- **Tests run:** `npx tsc --noEmit` → **clean (0 errors, previously 16)** · `npm run seed` without `--force` → refused ✅ · `NODE_ENV=production npm run seed -- --force` → refused ✅ · dev-server smoke: `/login` 200 without demo credentials, `/` 307→`/login` (auth flow intact), `/clear-cookies` 200 in dev ✅
- **Remaining issues:** Atlas credentials still need rotation (**user action**); replica set / upload hardening / finalized-match guard are Sprint 1.2; discovered `ftf/` is not its own git repo (git root is a stray repo at `C:/Users/Ala`) — recommend `git init` here
- **Next batch proposed:** **Sprint 1.2 — Upload & mutation safety:** `lib/uploads.ts` (MIME sniff, 2 MB cap, safe names) refactoring the 3 duplicated upload helpers · reject event/score mutations on homologated matches · docker-compose single-node replica set + healthchecks + env-based creds

### Batch 2 — Sprint 1.2: Upload & mutation safety (2026-07-10) ✅
- **Created:** `lib/uploads.ts` — shared image-upload helper: magic-byte type detection (PNG/JPEG/WebP only), 2 MB cap, server-generated file names, `UploadError` → 400 responses
- **Modified:** `app/api/admin/{clubs,joueurs,arbitres}/route.ts` (3 duplicated unsafe helpers replaced; UploadError handling in POST/PUT) · `app/api/admin/matchs/[id]/route.ts` + `app/api/admin/matchs/route.ts` + `app/api/admin/matchs/[id]/events/route.ts` (**mutations/deletion rejected with 409 on homologated matches** — until the official reopen workflow lands in Phase 4) · `docker-compose.yml` (mongo single-node replica set `rs0` with self-initiating healthcheck → **MongoDB transactions now work in dev**; app healthcheck; DB port bound to 127.0.0.1; zero hardcoded secrets — `NEXTAUTH_SECRET` required via env) · `.env.example` (local replica-set URI hint)
- **Tests run:** `npx tsc --noEmit` clean · `docker compose config` valid · dev-server smoke: `/login` 200; `/api/admin/clubs` and events POST correctly 401 unauthenticated
- **Remaining issues:** finalized-match guard + upload validation get automated tests in Sprint 1.4 (test stack); Mongo runs without auth in dev compose (documented: prod = Atlas or auth+keyFile); Atlas credential rotation still pending (user)
- **Next batch proposed:** **Sprint 1.3 — Roles & user hardening:** migration `ADMIN→FTF_ADMIN` / `CLUB→CLUB_ADMIN` with read-compat, extended `User` model (status, lockout, mustChangePassword), status enforcement at login + session, failed-login lockout

### Batch 3 — Sprint 1.3: Roles & user hardening (2026-07-10) ✅
- **Created:** `scripts/migrations/001-roles.ts` (idempotent; `ADMIN→FTF_ADMIN`, `CLUB→CLUB_ADMIN` + backfill status/failedLoginAttempts/mustChangePassword) — **executed against the dev DB: 1 admin + 6 club users converted, 0 legacy roles remaining**
- **Modified:** `lib/models/User.ts` (name, status ACTIVE/SUSPENDED/INVITED/DISABLED, mustChangePassword, lastLoginAt, failedLoginAttempts, lockedUntil, createdBy; `password` en `select: false`; `clubId` requis pour CLUB_ADMIN) · `lib/auth.ts` (lockout 5 tentatives → 15 min; statut vérifié au login **et** revalidé en session toutes les 10 min côté Node — session invalidée si compte suspendu/désactivé; normalisation + auto-réparation des rôles legacy; compteurs via `updateOne`) · `types/next-auth.d.ts` · `middleware.ts` · `app/page.tsx` · `app/{admin,club}/layout.tsx` · `components/{Navbar,Sidebar}.tsx` · 11 fichiers `app/api/admin/*/route.ts` (checks `FTF_ADMIN`) · `scripts/seed.ts` (nouveaux rôles + name/status)
- **Tests run:** `npx tsc --noEmit` clean · **login E2E réel via HTTP** : csrf → callback/credentials → session retourne `"role":"FTF_ADMIN"` ✅ · mauvais mot de passe → pas de session + `failedLoginAttempts` incrémenté en base ✅ · `lastLoginAt` renseigné ✅
- **Remaining issues:** tests automatisés du lockout complet (5 échecs → verrouillage) arrivent avec la stack de test (Sprint 1.4); les sessions existantes émises avant la migration restent valides via la normalisation dans le callback jwt
- **Next batch proposed:** **Sprint 1.4 — Plumbing:** `lib/api.ts` (requireAdmin/requireClub/apiError/pagination), premiers validateurs zod (match, événements), modèle `AuditLog` + `AuditService`, stack de test Vitest + mongodb-memory-server, pagination des listes existantes

### Batch 4 — Sprint 1.4: Plumbing (2026-07-10) ✅ — clôture de la Phase 1
- **Created:** `lib/api.ts` (requireAdmin/requireClub — clubId TOUJOURS depuis la session —, ApiError, apiError sanitisé zod→400, parsePagination avec plafond dur) · `lib/validators/{common,match,event}.ts` (zod : ObjectId, création/màj de match, événements — protection mass-assignment) · `lib/models/AuditLog.ts` (immuable, indexé) · `lib/services/audit.service.ts` · `lib/auth-core.ts` (`verifyCredentials` extrait de NextAuth pour être testable) · `vitest.config.ts` · `tests/validators.test.ts` (19 cas) · `tests/auth-core.test.ts` (10 cas : lockout complet 5 échecs→verrou→refus du bon mdp→déverrouillage, statuts SUSPENDED/DISABLED, auto-réparation rôle legacy)
- **Modified:** `app/api/admin/matchs/route.ts` + `matchs/[id]/route.ts` + `matchs/[id]/events/route.ts` (helpers + zod + audit MATCH_CREATED/UPDATED/DELETED/RESULT_UPDATED/EVENT_ADDED/UPDATED/DELETED avec before/after) · pagination plafonnée sur clubs/joueurs/arbitres/matchs GET · `lib/auth.ts` (authorize délègue à auth-core) · `package.json` (scripts test/test:watch; devDeps vitest + mongodb-memory-server)
- **Bug trouvé & corrigé en route:** `populate('evenements.joueurId')` sans import du modèle Joueur → `MissingSchemaError` latent (marchait seulement si une autre route avait déjà enregistré le modèle) — imports d'enregistrement ajoutés aux 3 routes matchs
- **Tests run:** `npx tsc --noEmit` clean · **26/26 tests verts** (3,9 s) · smoke authentifié réel : liste matchs 200 · événement sur match homologué → **409** message français · carton sans équipe → **400** zod · patch score match programmé → **200** puis **2 entrées AuditLog vérifiées en base** (action, before/after, actorRole) · score de test reverti
- **Remaining issues:** limites de pagination volontairement hautes (200/500) tant que l'UI n'a pas de DataTable paginée (Phase 2) ; routes competitions/saisons/standings/clubs[id]/availability gardent l'ancien pattern d'auth (adoptées lors de leur rework Phase 2) ; rotation Atlas toujours en attente (user)

### Batch 5 — Sprint 2.1: Models & organization (2026-07-10) ✅
- **Created:** `lib/models/Organization.ts` (SaaS boundary model) · `lib/models/DisciplinaryRuleSet.ts` (versioned discipline settings) · `scripts/migrations/002-organization.ts` (idempotent Stage A-B multi-tenancy backfill) · `scripts/migrations/006-rulesets.ts` (creates rule sets from Saison config) · `tests/organization.test.ts` (unit tests for models and links)
- **Modified:** `lib/models/{User,Club,Joueur,Saison,Competition,Match,Arbitre}.ts` (added optional `organizationId` and new extended schema fields) · `scripts/seed.ts` (seeds default FTF organization, links all models to it, creates season rule sets)
- **Tests run:** `npx tsc --noEmit` clean · `npm run test` → **31/31 tests verts** (5 nouveaux tests validant l'unicité et les relations d'organisation et règlements) · **test de fumée réel (smoke test) HTTP authentifié** : CSRF → Callback/Credentials (Login Admin) → Session vérifiée `ACTIVE` et rôle `FTF_ADMIN` → GET `/api/admin/clubs` renvoie bien `200 OK` avec les 6 clubs tunisiens seedés (EST, CA, ESS, USM, CSS, ST) ✅
- **Remaining issues:** aucun problème restant dans ce batch ; les actions utilisateur restent listées ci-dessous

### Batch 6 — Sprint 2.2: APIs & pages (2026-07-10) ✅ — clôture de la Phase 2
- **Created:** `lib/validators/season.ts` (validateurs zod saison) · `lib/validators/competition.ts` (validateurs zod compétition & clubs) · `app/api/admin/seasons/route.ts` & `[id]/route.ts` & `[id]/[action]/route.ts` (APIs CRUD + activate/complete/archive) · `app/api/admin/competitions/[id]/clubs/route.ts` (API inscription des clubs) · `components/ui/{PageHeader,StatusBadge,StatCard,EmptyState,ConfirmationDialog,DataTable,FilterBar}.tsx` (composants d'interface partagés) · `app/admin/saisons/page.tsx` & `[id]/page.tsx` (pages workspace saisons avec onglets) · `app/admin/competitions/page.tsx` & `[id]/page.tsx` (pages workspace compétitions avec onglets) · `tests/seasons-competitions-api.test.ts` (tests d'intégration complets des routes d'API)
- **Modified:** `types/next-auth.d.ts`, `lib/auth-core.ts` & `lib/auth.ts` (propagation de `organizationId` dans la session) · `lib/services/audit.service.ts` (audit multi-tenant) · `app/api/admin/competitions/route.ts` & `[id]/route.ts` (mise en conformité multi-tenancy) · `app/api/admin/saisons/route.ts` (link par alias ES6 propre) · `lib/models/Saison.ts` & `lib/models/Competition.ts` (passage en Stage C : `organizationId` requis + index uniques composés par organisation)
- **Tests run:** `npx tsc --noEmit` clean · `npm run test` → **38/38 tests verts** (7 nouveaux tests d'intégration d'API + 31 tests unitaires existants verts)
- **Remaining issues:** aucun problème restant

### Batch 7 — Phase 3: Journées & Calendar Generation (2026-07-10) ✅ — clôture de la Phase 3
- **Created:** `lib/models/Round.ts` (modèle Journée) · `scripts/migrations/003-rounds.ts` (migration de reprise d'historique) · `lib/services/round.service.ts` (évaluation de complétude de journée) · `lib/services/schedule-generation.service.ts` (algorithme d'appariement de Berger) · `app/api/admin/rounds/route.ts` & `[id]/route.ts` (APIs CRUD journées) · `app/api/admin/competitions/[id]/generate-calendar/route.ts` (déclencheur de génération) · `tests/schedule-generation.test.ts` (suite complète de tests de planification)
- **Modified:** `lib/models/Match.ts` (liaison roundId, validation Stage C) · `app/api/admin/matchs/route.ts` (filtre par compétition et journée sur le listing) · `app/admin/competitions/[id]/page.tsx` (intégration de l'onglet Journées, compteurs KPIs et dialogue de génération automatique) · `components/ui/EmptyState.tsx` (support d'actions enfants)
- **Tests run:** `npx tsc --noEmit` clean · `npm run test` → **43/43 tests verts** (5 nouveaux tests unitaires/intégration de génération Berger en réplica set)
- **Remaining issues:** aucun problème restant
- **Next batch proposed:** **Phase 4 — Match Results :** Page de détail d'une journée (`/admin/competitions/[id]/rounds/[roundId]`) avec grille des rencontres et saisie en masse en brouillon, et implémentation du `MatchFinalizationService` (traitement transactionnel atomique des résultats : calculs des cartons, suspensions, statistiques joueurs et classement).

### Batch 8 — Phase 4: Match Results (2026-07-10) ✅ — clôture de la Phase 4
- **Created:**
  - `lib/models/Standings.ts` (snapshot de classement avec rows, form[], calculatedAt, matchesProcessed ; index unique par compétition)
  - `lib/services/standings.service.ts` (`StandingsService.rebuildCompetitionStandings()` : rebuild depuis les matchs homologués, points→GD→GF, upsert snapshot + sync classement embedded)
  - `lib/services/match-finalization.service.ts` (`MatchFinalizationService` : atomique, idempotent, verrou par `processingVersion`, validation score/événements, audit DANS la transaction, rebuild standings + round completion post-commit)
  - `lib/services/match-correction.service.ts` (`MatchCorrectionService` : réouverture avec raison obligatoire, audit DANS la transaction, rebuild standings déterministe)
  - `scripts/migrations/004-match-status.ts` (backfill `isOfficial`, `processingVersion`, `forfeitCause` ; normalisation `À Valider` → `Brouillon`)
  - `app/api/admin/matches/[id]/finalize/route.ts` · `reopen/route.ts` · `reschedule/route.ts`
  - `app/api/admin/competitions/[id]/standings/route.ts` · `rebuild-standings/route.ts` · `rounds/[roundId]/route.ts`
  - `app/admin/competitions/[id]/rounds/[roundId]/page.tsx` (**flagship result-entry page** : grille match-by-match, saisie score, statut, notes, "Enregistrer brouillon", "Homologuer", "Homologuer tous", réouverture avec raison, KPIs)
  - `app/admin/competitions/[id]/standings/page.tsx` (tableau de classement complet : J/G/N/P/BP/BC/Diff/Forme/Pts, badges de forme, icônes de position, bouton Recalculer)
- **Modified:**
  - `lib/models/Match.ts` (statuts étendus : `Brouillon`, `Abandonné`, `Forfait`, `Replay Ordonné` ; champs `isOfficial`, `processingVersion`, `reopenReason/By/At`, `forfeitCause/Score` ; indexes de requête)
  - `lib/validators/match.ts` (`matchStatutSchema` avec nouveaux statuts ; `matchResultPatchSchema` + `notes`)
  - `lib/services/audit.service.ts` (`AuditService.logWithSession()` pour l'audit transactionnel)
  - `app/admin/competitions/[id]/page.tsx` (onglet "Classement" ajouté → redirige vers `/standings`)
- **Tests run:** `npx tsc --noEmit` → zéro erreur dans les fichiers sources (seules les erreurs `.next/dev/types/validator.ts` pre-existantes présentes — pattern async-params Next 15 commun à tout le codebase) · `npm run test` → **43/43 tests verts**
- **Remaining issues:** aucun problème restant
- **Next batch proposed:** **Phase 5 — Discipline Engine :** Lire `docs/disciplinary-rules-sources.md` (condition d'entrée obligatoire) → Sprint 5.1 (`DisciplinaryCard` model + `DisciplineEngine` orchestrateur dans la transaction de finalisation + `YellowCardAccumulationService`) → Sprint 5.2 (`Suspension`/`SuspensionServiceEntry` models + `SuspensionService` + `EligibilityService`) → Sprint 5.3 (UI discipline dashboard, notifications).

### Batch 9 — Phase 5: Discipline Engine (2026-07-10) ✅ — clôture de la Phase 5
- **Created:**
  - `lib/services/yellow-card-accumulation.service.ts` (Sprint 5.1 — full implementation: R-001 to R-006, R-004 season-end clearance)
  - `lib/services/discipline-engine.ts` (orchestrator called inside finalization transaction)
  - `lib/services/suspension.service.ts` (Sprint 5.2 — serving engine: countability evaluation, ledger, SERVED transition, R-008)
  - `lib/services/red-card-decision.service.ts` (Sprint 5.2 — provisional→decision, deduction of already-missed matches, cancel with reason)
  - `lib/services/eligibility.service.ts` (Sprint 5.2 — player availability, at-risk detection, anomaly detection R-009)
  - `lib/services/notification.service.ts` (Sprint 5.3 — idempotent notifications via dedupeKey)
  - `lib/models/DisciplinaryCard.ts` · `Suspension.ts` · `SuspensionServiceEntry.ts` · `Notification.ts` (Sprint 5.1/5.2 models)
  - `lib/models/DisciplinaryRuleSet.ts` (Sprint 2.1 — versioned rule configuration)
  - `app/api/admin/discipline/suspensions/route.ts` + `[id]/route.ts` (Sprint 5.3 — GET list, POST manual, GET detail + ledger, PUT cancel/amend)
  - `app/api/admin/discipline/red-decisions/route.ts` (Sprint 5.3 — GET pending, POST decision via RedCardDecisionService)
  - `app/api/admin/discipline/anomalies/route.ts` (Sprint 5.3 — detect SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT)
  - `app/api/admin/seasons/[id]/clear-cards/route.ts` (Sprint 5.3 — end-of-season clearance endpoint)
  - `app/api/admin/notifications/route.ts` (Sprint 5.3 — GET notifications with unread count)
  - `components/ui/CardBadge.tsx` · `SuspensionBadge.tsx` · `EligibilityBadge.tsx` · `AuditTimeline.tsx` · `NotificationItem.tsx`
  - `app/admin/discipline/page.tsx` (dashboard disciplinaire avec KPIs)
  - `app/admin/discipline/yellow-cards/page.tsx` (vue accumulation cartons jaunes)
  - `app/admin/discipline/red-cards/page.tsx` (décisions cartons rouges + dialogue décision)
  - `app/admin/discipline/suspensions/page.tsx` + `[id]/page.tsx` (liste + détail avec ledger)
  - `app/admin/discipline/anomalies/page.tsx` (anomalies de participation)
  - `app/admin/notifications/page.tsx`
  - `tests/discipline-engine.test.ts` (15 tests: yellow accumulation matrix, red decision flow, suspension serving, eligibility)
- **Modified:**
  - `lib/services/match-finalization.service.ts` (intégration DisciplineEngine + SuspensionService dans la transaction de finalisation)
  - `lib/services/eligibility.service.ts` (fix: `actif` → `status: 'ACTIVE'` — champ inexistant dans le modèle Joueur)
  - `lib/services/yellow-card-accumulation.service.ts` (fix: `matchesSuspended: 1` au lieu de 0 pour suspensions provisoires — contrainte `min: 1` du modèle)
  - `components/Sidebar.tsx` (ajout lien Notifications)
  - `app/admin/saisons/[id]/page.tsx` (ajout bouton "Effacer les cartons jaunes" en fin de saison)
- **Tests run:** `npx tsc --noEmit` → zéro nouvelle erreur (seuls les erreurs pré-existantes `.next/dev/types/validator.ts` persistantes) · `npm run test` → **58/58 tests verts** (15 nouveaux)
- **Remaining issues:** aucun problème restant
- **Next batch proposed:** **Phase 6 — Club Portal :** Créer les routes `/api/club/*` avec `requireClub()` (clubId depuis la session), pages club (dashboard, joueurs, matchs, cartes, suspensions, éligibilité, notifications, classement, profil) avec accès read-only et scope automatique.

### Batch 10 — Phase 6: Club Portal (2026-07-10) ✅ — clôture de la Phase 6
- **Created:**
  - `app/api/club/dashboard/route.ts` (GET aggregate: joueurs, prochains matchs, suspensions, cards, classement, notifications non lues)
  - `app/api/club/players/route.ts` (GET liste avec filtres status/position/search + pagination)
  - `app/api/club/players/[id]/route.ts` (GET détail joueur + cartes + suspensions — 404 si pas du club)
  - `app/api/club/matches/route.ts` (GET liste avec filtres statut/competitionId + pagination)
  - `app/api/club/matches/[id]/route.ts` (GET détail match avec vérification participant — 403 si non participant)
  - `app/api/club/cards/route.ts` (GET cartons disciplinaires avec filtres + pagination)
  - `app/api/club/suspensions/route.ts` (GET suspensions avec filtres status/type + pagination)
  - `app/api/club/eligibility/route.ts` (GET éligibilité ?matchId= ou liste des matchs à venir)
  - `app/api/club/standings/route.ts` (GET classement par compétition)
  - `app/api/club/notifications/route.ts` (GET liste avec compteur non lues + PUT mark-read)
  - `app/api/club/profile/route.ts` (GET profil + PUT nom/mot de passe avec vérification bcrypt)
  - `app/club/page.tsx` (dashboard retravaillé: stats KPIs, prochains matchs, suspensions, classement, notifications)
  - `app/club/players/page.tsx` + `[id]/page.tsx` (grille joueurs avec recherche + détail)
  - `app/club/matches/page.tsx` + `[id]/page.tsx` (liste avec filtres + détail match avec événements)
  - `app/club/cards/page.tsx` (cartons avec filtres par type, badges CardBadge)
  - `app/club/suspensions/page.tsx` (suspensions avec badges SuspensionBadge, filtres status)
  - `app/club/eligibility/page.tsx` (sélecteur de match + vue disponibilité avec EligibilityBadge)
  - `app/club/standings/page.tsx` (tableau classement complet avec forme, sélecteur compétition)
  - `app/club/notifications/page.tsx` (notifications avec bouton marquer lue, filtre non lues)
  - `app/club/profile/page.tsx` (mise à jour nom + changement mot de passe avec confirmation bcrypt)
  - `tests/club-auth.test.ts` (11 tests: requireClub() gate pour non-auth/FTF_ADMIN/sans clubId/valide, isolation données joueurs, refus cross-club accès match, isolation notifications, scope dashboard)
- **Modified:**
  - `components/Sidebar.tsx` (clubLinks remplacés par les vraies pages: players, matches, cards, suspensions, eligibility, standings, notifications, profile)
- **Tests run:** `npx tsc --noEmit` → zéro nouvelle erreur (seuls les erreurs pré-existantes `.next/dev/types/validator.ts` persistantes) · `npm run test` → **69/69 tests verts** (11 nouveaux tests club-auth + 58 existants)
- **Remaining issues:** aucun problème restant
- **Next batch proposed:** **Phase 7 — Reports, Audit UI, Search & Imports (part 2):** implement CSV imports (clubs, players, fixtures, results) with upload→validate→preview→confirm→process pipeline.

### Batch 11 — Phase 7 Part 1: Reports, Audit, Users, Settings, Search (2026-07-10) 🟨
- **Created:**
  - `lib/services/report.service.ts` (ReportService: 12 report types — fixtures/results, standings, goalscorers, cards by club/player, 2-warning players, suspensions active/provisional/served, red decisions, anomalies, club disciplinary summary; CSV generation via json2csv)
  - `app/api/admin/reports/route.ts` (GET catalog + POST generate/download CSV)
  - `app/api/admin/audit/route.ts` (GET with filters: action, entityType, entityId, date range)
  - `app/api/admin/users/route.ts` + `app/api/admin/users/[id]/route.ts` (GET list/detail, POST create, PUT update status/password, DELETE soft-disable)
  - `app/api/admin/settings/route.ts` (GET organization, current season, disciplinary rule sets)
  - `app/api/admin/search/route.ts` (GET global search across joueurs, clubs, matches, competitions)
  - `app/admin/reports/page.tsx` (report catalog grid with one-click CSV download)
  - `app/admin/audit/page.tsx` (filterable audit log browser with AuditTimeline component)
  - `app/admin/users/page.tsx` (user list with create form, status toggle, password reset)
  - `app/admin/settings/page.tsx` (org info, current season, rule sets display)
- **Modified:**
  - `components/Sidebar.tsx` (added links: Rapports, Audit, Utilisateurs)
- **Dependencies added:** `json2csv` (CSV export) + `@types/json2csv`
- **Tests run:** `npx tsc --noEmit` → zéro nouvelle erreur (seuls les erreurs pré-existantes `.next/dev/types/validator.ts` persistantes) · `npm run test` → **69/69 tests verts**
- **Remaining issues:** CSV imports (clubs, players, fixtures, results) not yet implemented
- **Next batch proposed:** **Phase 7 Part 2 — CSV Imports:** upload→validate→preview→confirm→process pipeline

### Batch 12 — Large realistic development dataset (2026-07-11) ✅
- **Modified:** `scripts/seed.ts` — deterministic LP1 2025-2026 scale seed based on the public 16-club/30-round/240-match competition structure; full-collection document reset compatible with restricted Atlas users; real club identities and stadium metadata; 24 safe test-player fixtures per club; complete calendar; mixed official/draft/postponed/scheduled states; embedded match events; canonical cards; automatic/provisional suspensions; serving ledger; standings; notifications; audit history; derived player/season statistics.
- **Database reset executed:** Atlas database `ftfa` cleared and reseeded successfully.
- **Result:** 16 clubs · 384 players · 48 staff · 10 referees · 30 rounds · 240 matches (176 official) · 622 cards · 155 suspensions.
- **Tests run:** `npx tsc --noEmit` clean · `npm run test` → **69/69 tests green** · destructive guard retained (`--force`, production refusal).
- **Data note:** club/competition structure and stadium identities are public real-world data; player identities are deterministic QA fixtures and are not represented as the federation's official registration roster.

### Batch 13 — Review, sidebar fixes, login redesign, seed assets (2026-07-11) ✅
- **Review fixes:** `lib/api.ts` (+`escapeRegex`) appliqué à `app/api/club/players` et `app/api/admin/search` (**injection regex corrigée** — `search=(((` cassait la requête, désormais 200) · `next.config.ts` (**`output: 'standalone'` restauré** — le Dockerfile copie `.next/standalone`, le build Docker était cassé sans lui ; + `dangerouslyAllowSVG` avec CSP sandbox pour les assets SVG locaux)
- **Sidebar admin réparée:** créé `app/api/admin/staff/route.ts` + `app/admin/staff/page.tsx` (annuaire du staff groupé par club, recherche debounce, filtre fonction) · liens `transferts`/`licences`/`evenements` retirés (modules gelés hors périmètre v1 — commentés dans `components/Sidebar.tsx`, réactivables)
- **Login redécoré** (`app/login/page.tsx`): split-screen institutionnel — panneau navy avec tracé de terrain SVG + liseré rouge tunisien, police Archivo scoped, animations d'entrée échelonnées, icônes champs, accessibilité conservée (labels, role=alert, autocomplete)
- **Assets seedés** (`scripts/asset-helpers.ts` + `scripts/seed.ts`): 16 blasons SVG bicolores (`/uploads/clubs/<CODE>.svg`) + 384 avatars joueurs aux couleurs du club (`/uploads/joueurs/<licence>.svg`) — génération déterministe hors-ligne ; seed ré-exécuté (176 matchs homologués, 622 cartons, 155 suspensions)
- **Tests run:** `npx tsc --noEmit` clean · **69/69 tests verts** · smoke HTTP réel : login page 200 avec nouveau design ✅ · `/uploads/clubs/EST.svg` 200 `image/svg+xml` ✅ · avatar joueur 200 ✅ · login admin → staff API 200 + staff page 200 ✅ · recherche regex `(((` sans erreur ✅
- **Remaining issues:** liens gelés réactivables si le périmètre change (décision produit) ; rotation Atlas toujours en attente (user)

## Open blockers & user actions

| Item | Owner | Status |
|---|---|---|
| Rotate MongoDB Atlas password + NEXTAUTH_SECRET (exposed in `.env.local` and chat) | **User** | ⬜ |
| Was the repo ever pushed to a remote? (determines git-history purge need) | **User** | ⬜ question |
| Official FTF Code Disciplinaire PDF for article-level citations | **User** (or web research at Phase 5 start) | ⬜ |
| SMTP availability for email notifications | **User** | ⬜ (in-app only until answered) |
| Document storage: local volume ok for v1, or S3/MinIO available? | **User** | ⬜ |
