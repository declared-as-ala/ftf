# Implementation Roadmap — Phases, Sprints & Batches

> Execution order for turning FTF into the platform described in [product-specification.md](product-specification.md).
> **Batch rules:** every batch is small, independent and testable. After each batch: update [progress.md](progress.md) (status, modified files, tests run, remaining issues) and propose the next batch. No batch starts until the previous one is verified.
> Priorities: **P0** security/data-integrity blocker · **P1** required for the main platform · **P2** important operational · **P3** enhancement.

---

## Phase 1 — Security & Authentication (P0/P1)

### Sprint 1.1 — Safe P0 fixes ✅ (2026-07-10)
- [x] Fix `lib/models/Arbitre.ts` interface naming (`Arbitre` → `IArbitre`) — `tsc --noEmit` clean
- [x] Create `.env.example`; remove fallback secret (`lib/auth.ts`) and localhost URI fallback (`lib/db.ts`) — fail fast at boot
- [x] Seed production guard in `scripts/seed.ts` (`NODE_ENV=production` refuses; `--force` required to wipe)
- [x] Remove demo credentials + cookie hack from `app/login/page.tsx`; gate `/clear-cookies` to dev
- [x] (added) Fix pre-existing tsc errors: `_id: string` in 12 model interfaces, populate typing in `lib/auth.ts`, `darkMode` in `tailwind.config.ts`
- [ ] ⚠️ User action: rotate Atlas password + NEXTAUTH_SECRET (tracked, not code)

### Sprint 1.2 — Upload & mutation safety (P0) ✅ (2026-07-10)
- [x] `lib/uploads.ts` (magic-byte MIME whitelist, 2 MB cap, server-generated names); refactor the 3 duplicated upload helpers (clubs/joueurs/arbitres routes)
- [x] Guard finalized matches: `api/admin/matchs/[id]` PUT + `.../events` + collection PUT/DELETE reject mutations when `homologue === true` (409)
- [x] `docker-compose.yml`: mongo as single-node replica set (`--replSet rs0`, self-initiating healthcheck), app healthcheck, DB port on 127.0.0.1, secrets from env (`NEXTAUTH_SECRET` required)

### Sprint 1.3 — Roles & user hardening (P1) ✅ (2026-07-10)
- [x] Migration `scripts/migrations/001-roles.ts` (`ADMIN→FTF_ADMIN`, `CLUB→CLUB_ADMIN`) + read-compat in auth callbacks; update `types/next-auth.d.ts`, `middleware.ts`, all role checks — migration executed on dev DB
- [x] Extend `User`: name, status, mustChangePassword, lastLoginAt, failedLoginAttempts, lockedUntil, createdBy; `password` → `select: false`
- [x] Enforce status at login + periodic session revalidation (10 min, Node runtime); lockout after 5 failed attempts (15 min)

### Sprint 1.4 — Plumbing (P1) ✅ (2026-07-10)
- [x] `lib/api.ts`: `requireAdmin()`, `requireClub()`, `apiError()`, `parsePagination()`; adopted in matchs routes (remaining routes adopt at their Phase 2 rework)
- [x] `lib/validators/` started (common, match, event schemas); zod parsing in match/event routes
- [x] `AuditLog` model + `AuditService.log()`; wired into all match/event mutations (before/after)
- [x] Test stack: Vitest + mongodb-memory-server; 26 tests green (validators + full lockout/status/legacy-role matrix via extracted `lib/auth-core.ts`)
- [x] Pagination caps on existing list endpoints (clubs, joueurs, matchs, arbitres)

**Phase gate: ✅ PASSED** — tsc clean · 26 tests green · finalized matches locked (409 verified over HTTP) · seed safe · audit entries verified in DB.

---

## Phase 2 — Seasons & Competitions (P1)

### Sprint 2.1 — Models & organization ✅ (2026-07-10)
- [x] `Organization` model + seed FTF org; staged `organizationId` migration Stages A–B (`scripts/migrations/002-organization.ts`)
- [x] Extend `Saison` (code/status/isCurrent — one current per org) and `Competition` (tieBreakers, isOfficial, code, status, ruleSet link)
- [x] `DisciplinaryRuleSet` model + `scripts/migrations/006-rulesets.ts` (v1 from `Saison.configuration`)

### Sprint 2.2 — APIs & pages
- [ ] `api/admin/seasons` full CRUD + activate/complete/archive actions
- [ ] `api/admin/competitions` full CRUD + club registration
- [ ] `/admin/seasons` + `[id]` pages (tabs per spec)
- [ ] `/admin/competitions` list + `[id]` workspace shell (overview + clubs + rules tabs; other tabs land in later phases)
- [ ] Shared components batch 1: PageHeader, DataTable, FilterBar, StatusBadge, ConfirmationDialog, EmptyState/ErrorState, StatCard
- [ ] organizationId Stage C (required + compound indexes) once backfill verified

---

## Phase 3 — Journées (P1)

### Sprint 3.1 — Round model & migration
- [ ] `Round` model (unique org+competition+number) + `scripts/migrations/003-rounds.ts` (derive from `Match.journee`, stamp `roundId`)
- [ ] `RoundService` (CRUD, completion detection per spec §5.9)

### Sprint 3.2 — Fixture generation
- [ ] `ScheduleGenerationService`: round-robin single + home/away; conflict validation (same club twice, home=away, duplicate fixture, non-member club); never overwrite existing calendar
- [ ] `api/admin/rounds` (+`[id]`)
- [ ] `/admin/competitions/[id]/rounds` list page
- [ ] Unit tests: generation + conflicts

---

## Phase 4 — Match Results (P1 — the core)

### Sprint 4.1 — Match & event model upgrade
- [ ] Extend `Match`: new status enum (+ legacy mapping migration `004-match-status.ts`), isOfficial, finalization fields, processingVersion, forfeit fields
- [ ] `MatchEvent` model + migration `005-events.ts` (embedded `evenements[]` → collection; embedded becomes read-only legacy)
- [ ] Rework `api/admin/matches` namespace (list/create/detail/events; drafts editable, finalized locked; legacy `matchs` aliases kept)

### Sprint 4.2 — Finalization engine
- [ ] `MatchFinalizationService`: transactional, idempotent (atomic status claim + processingVersion), score-vs-events validation, audit, notification hooks (engine wired fully in Phase 5)
- [ ] `api/admin/matches/[id]/finalize` + `/reschedule`
- [ ] Integration tests: duplicate + concurrent finalization, transaction rollback

### Sprint 4.3 — Reopen & standings
- [ ] `MatchCorrectionService` (reopen with reason; deterministic rebuild) + `api/admin/matches/[id]/reopen`
- [ ] `StandingsService.rebuildCompetitionStandings()` + `Standings` snapshot collection + `competitions/[id]/standings` & `rebuild-standings` endpoints
- [ ] `/admin/standings` page rework (rebuild button, calculatedAt); deprecation headers on `MatchService`
- [ ] Standings unit tests (points config, tiebreakers, forfeits, rebuild-after-reopen)

### Sprint 4.4 — Result-entry UX (flagship)
- [ ] `/admin/competitions/[id]/rounds/[roundId]` result-entry page: match grid, bulk score entry, per-match drawer (goals/cards/notes/document), save drafts, finalize selected, finalize journée, filters
- [ ] `/admin/matches` list + `/new` + `[id]` tabbed detail (overview/goals/cards/audit; discipline tab in Phase 5)
- [ ] Components: MatchCard, ScoreDisplay, MatchTimeline, RoundProgress, FormDrawer

---

## Phase 5 — Discipline Engine (P1 — the heart)

**Entry condition:** verification pass on [disciplinary-rules-sources.md](disciplinary-rules-sources.md) (search newer FTF editions; fill article numbers).

### Sprint 5.1 — Cards & accumulation
- [ ] `DisciplinaryCard` model; `DisciplineEngine` orchestrator inside finalization transaction
- [ ] `YellowCardAccumulationService` (threshold from RuleSet, auto-suspension, consume cards, same-match yellow+red rule, season-end clearance op)
- [ ] Unit tests: full accumulation matrix from [testing.md](testing.md)

### Sprint 5.2 — Suspensions & serving ledger
- [ ] `Suspension` + `SuspensionServiceEntry` models (unique suspensionId+matchId)
- [ ] `SuspensionService` serving engine (countability evaluation, ledger, SERVED transition, manual corrections with reason)
- [ ] `RedCardDecisionService` (provisional → decision, already-missed deduction)
- [ ] `EligibilityService` (absorbs `DisciplineService.getPlayerAvailabilityForMatch`); anomalies incl. `SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT`
- [ ] Integration tests: red flow, serving matrix, double-decrement impossible

### Sprint 5.3 — Discipline UI & notifications
- [ ] `NotificationService` + `Notification` model (dedupeKey)
- [ ] `api/admin/discipline/*` routes (cards, suspensions, red-decisions, anomalies) + `api/admin/notifications`
- [ ] Pages: `/admin/discipline` dashboard, `yellow-cards`, `red-cards`, `suspensions` (+`[id]` with ledger), `anomalies`, `/admin/notifications`
- [ ] `/admin/players` + `[id]` rework (disciplinary timeline, serving ledger)
- [ ] Components: CardBadge, SuspensionBadge, EligibilityBadge, AuditTimeline, NotificationItem
- [ ] End-of-season clearance action on `/admin/seasons/[id]`

---

## Phase 6 — Club Portal (P1)

### Sprint 6.1 — Club APIs
- [x] `api/club/*`: dashboard, players (+id), matches (+id), cards, suspensions, eligibility, standings, notifications, profile — all via `requireClub()` (session-derived clubId)
- [x] Authorization test suite (cross-club denial, write denial, admin-API denial, disabled-user denial)

### Sprint 6.2 — Club pages
- [x] `/club/dashboard` rework (next-match card w/ unavailable count, standing, recent cards/notifications)
- [x] `/club/players` (+`[id]`), `/club/matches` (+`[id]`), `/club/calendar`, `/club/cards`, `/club/suspensions`, `/club/eligibility` (per-match selector), `/club/standings`, `/club/notifications` (mark read), `/club/profile` (password change)
- [x] Sidebar club links replaced with the real set; no edit affordances on sporting data

---

## Phase 7 — Reports, Audit UI, Search & Imports (P2)

- [x] `ReportService` + `/admin/reports` (CSV/Excel; 12 report types) — report catalog per spec §10
- [x] Club report downloads (reusable via ReportService)
- [x] `/admin/audit` read-only browser with filters (action, entityType, entityId, date range)
- [x] `/admin/users` page (create club admin, status toggle, password reset, require-change)
- [x] `/admin/settings` (organization, current season, rule sets display)
- [x] Global admin search API (`/api/admin/search?q=`) across joueurs/clubs/matchs/competitions
- [ ] CSV imports (clubs, players, fixtures, results): upload→validate→preview→confirm→process→report + templates

---

## Phase 8 — Production Ready (P1/P2)

- [ ] Security headers + prod cookie/session config; restrict `images.remotePatterns`
- [ ] `/api/health` healthcheck; compose restart policies; Mongo not publicly exposed; uploads volume strategy (standalone-output compatible)
- [ ] CI (GitHub Actions): tsc + lint + tests + build
- [ ] Production admin bootstrap script (no demo users); seed v2 (8+ clubs, 18+ players/club, engine-exercising data)
- [ ] E2E (Playwright): yellow-card journey + red-card journey (per [testing.md](testing.md) §5)
- [ ] Docs: `deployment.md`, `backup-and-restore.md`, `user-guide-admin.md`, `user-guide-club.md`; resolve empty INSTALLATION/QUICKSTART/START_HERE placeholders (ask owner)
- [ ] Logging & error-monitoring hookup; backup/restore procedure tested

---

## Deferred / P3

Email notifications (needs SMTP) · Arabic/RTL localization · background jobs for large exports · frozen modules (Licence, Transfert, referee workflows) · multi-organization onboarding UI.

## Standing decisions

| # | Decision |
|---|---|
| D1 | Keep French model names (Joueur, Saison, Club…); new models in English |
| D2 | `organizationId` staged (Phase 2), required after backfill |
| D3 | Embedded `Competition.classement` deprecated in place → `Standings` snapshot collection |
| D4 | Dev Mongo = single-node replica set; production = real replica set/Atlas |
| D5 | Legacy `matchs` API routes kept as aliases during `matches` transition |
| D6 | Deprecated services kept with `@deprecated` headers — nothing deleted without owner approval |
| D7 | In-app notifications first; email only if SMTP provided |
| D8 | Licence/Transfert/Evenement/match-sheet models frozen as future modules |
