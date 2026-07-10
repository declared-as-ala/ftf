# NEXTSTEP.md — FTF Roadmap & Progress Tracker

> **⚠️ Superseded by `docs/` (2026-07-10).** The authoritative documents are now:
> - Spec: [docs/product-specification.md](docs/product-specification.md)
> - Roadmap (phases/sprints/batches): [docs/implementation-roadmap.md](docs/implementation-roadmap.md)
> - **Progress tracker (update after EVERY batch): [docs/progress.md](docs/progress.md)**
> - Audit: [docs/architecture-audit.md](docs/architecture-audit.md) · Data model: [docs/database.md](docs/database.md) · API: [docs/api.md](docs/api.md) · Security: [docs/security.md](docs/security.md) · Testing: [docs/testing.md](docs/testing.md) · UI/UX: [docs/ui-ux.md](docs/ui-ux.md) · Rules register: [docs/disciplinary-rules-sources.md](docs/disciplinary-rules-sources.md)
>
> This file is kept as the original roadmap seed; do not update checkboxes here — use `docs/progress.md`.

Working plan for transforming FTF into a production-ready competition & disciplinary management SaaS.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done.
Priorities: **P0** security/data-integrity blocker · **P1** required for main platform · **P2** important operational · **P3** enhancement.

---

## Current state (audit summary — 2026-07-10)

| Area | Status |
|---|---|
| Auth (credentials, JWT, role routing) | Working but insecure defaults (fallback secret, no lockout/status/rate-limit, demo creds shown in UI) |
| Admin portal | 8 pages working (dashboard, clubs+detail, joueurs, matchs+detail, arbitres, classement); 8 sidebar links 404 |
| Club portal | Dashboard only; 7 sidebar links 404; zero `/api/club/*` routes |
| Discipline | Service code exists but **never called** — cards produce no discipline records in practice |
| Homologation | `MatchService.homologuerMatch()` is dead code; no route invokes it |
| Standings | Two competing implementations; embedded `classement` never initialized (silent no-op) |
| Rounds (Journées) | No model — `journee` is a bare number on Match |
| Validation | zod + react-hook-form installed, unused |
| Tests | None |
| Transactions | Impossible (standalone Mongo in compose) |
| Notifications / Audit / Reports / Search / Pagination | Missing entirely |
| Secrets | **Committed live Atlas URI + secret in `.env.local` — rotate** |
| TypeScript | `lib/models/Arbitre.ts` has IArbitre/Arbitre naming bug → `tsc` fails |

---

## Phase 0 — P0: Stop the bleeding (security & integrity blockers)

Small, independent fixes. No feature work until these are done.

- [ ] **P0** Rotate MongoDB Atlas credentials + NEXTAUTH_SECRET (user action); confirm `.env.local` stays gitignored; purge from git history if repo is/was pushed
- [ ] **P0** Create `.env.example` (all vars, no values); fail fast at boot when `MONGODB_URI`/`NEXTAUTH_SECRET` missing — remove fallback secret in `lib/auth.ts:84` and localhost fallback in `lib/db.ts:4`
- [ ] **P0** Fix `lib/models/Arbitre.ts` — rename interface to `IArbitre` consistently; run `npx tsc --noEmit` clean
- [ ] **P0** Seed guard: `scripts/seed.ts` refuses to run when `NODE_ENV=production` (or requires `--force` + explicit confirmation); stop wiping DB by default
- [ ] **P0** Remove demo credentials from `app/login/page.tsx` UI + remove the cookie-clearing hack (lines 27–32); gate `/clear-cookies` page to dev only (keep file, guard it)
- [ ] **P0** Upload hardening in `api/admin/clubs`, `api/admin/joueurs`, `api/admin/arbitres`: whitelist MIME (sniff magic bytes), cap size (2 MB images), generate safe extension from detected type — shared helper `lib/uploads.ts`
- [ ] **P0** docker-compose: run mongo as single-node replica set (`--replSet rs0` + init) so transactions work in dev; add healthchecks; move creds to env
- [ ] **P0** Guard event mutation on finalized matches: `api/admin/matchs/[id]/events` rejects changes when match is homologated/official (until reopen workflow exists in Phase 3)
- [ ] **P1** Login rate limiting + account lockout fields (`failedLoginAttempts`, `lockedUntil`) — minimal version now, full auth model in Phase 1

---

## Phase 1 — Foundation migration (models, roles, org, validation, audit)

### 1A. Role & user migration
- [ ] Migrate role values `ADMIN→FTF_ADMIN`, `CLUB→CLUB_ADMIN`: migration script `scripts/migrations/001-roles.ts` + temporary read-compat in `lib/auth.ts` session callback; update `types/next-auth.d.ts`, `middleware.ts`, all role checks (grep `'ADMIN'` / `'CLUB'`)
- [ ] Extend `User` model: `name`, `status (ACTIVE|SUSPENDED|INVITED|DISABLED)`, `mustChangePassword`, `lastLoginAt`, `failedLoginAttempts`, `lockedUntil`, `createdBy`; enforce status at login + session; CLUB_ADMIN requires valid `clubId`
- [ ] Never return `password` field from any query (`select: false` on schema)

### 1B. Organization boundary (staged — see Decisions)
- [ ] New model `lib/models/Organization.ts`; seed FTF org
- [ ] Migration `scripts/migrations/002-organization.ts`: stamp `organizationId` on User, Club, Saison, Competition, Match, Joueur, Staff, Arbitre, Discipline
- [ ] Add `organizationId` (required after backfill) to schemas + compound indexes; helper `lib/org.ts` to resolve org from session

### 1C. New domain models (English names, per spec §9)
- [ ] `Round.ts` (journée) — unique `(organizationId, competitionId, number)`
- [ ] `MatchEvent.ts` — normalized events (GOAL/OWN_GOAL/PENALTY_GOAL/PENALTY_MISSED/YELLOW_CARD/SECOND_YELLOW_RED/DIRECT_RED), status DRAFT|CONFIRMED|CANCELLED
- [ ] `DisciplinaryCard.ts` — with `accumulationStatus`, `generatedSuspensionId`
- [ ] `DisciplinaryRuleSet.ts` — versioned, per season/competition/category, source-document references
- [ ] `Suspension.ts` — total/served/remaining, scope, status incl. PENDING_DECISION/PROVISIONAL, decision fields
- [ ] `SuspensionServiceEntry.ts` — ledger, **unique (suspensionId, matchId)**
- [ ] `Notification.ts`, `AuditLog.ts`
- [ ] Adapt `Match.ts`: add `roundId`, `isOfficial`, new status enum (DRAFT…REPLAY_ORDERED), forfeit fields, `finalizedAt/By`, `reopenedAt/By/Reason`, `processingVersion`; keep legacy fields during migration
- [ ] Adapt `Competition.ts`: `isOfficial`, `tieBreakers[]`, `disciplinaryRuleSetId`, status enum; deprecate embedded `classement` (leave field, stop writing)
- [ ] Adapt `Club.ts`: `code`, `slug`, `shortName`, `status`; unique `(org, code)`, `(org, slug)`
- [ ] Adapt `Joueur.ts`: `status`, `displayName`, `category`; unique licence per org; keep French model name (see Decisions)
- [ ] Adapt `Saison.ts`: `code`, `status`, `isCurrent` (one current per org)
- [ ] Indexes pass across all models (foreign keys, common query paths)

### 1D. Cross-cutting plumbing
- [ ] `lib/validators/` — zod schemas per entity; adopt in every existing mutating route
- [ ] `lib/services/audit.service.ts` — `AuditService.log()`; wire into existing admin mutations
- [ ] `lib/api.ts` helpers: `requireAdmin()`, `requireClubSession()`, sanitized error responses, request IDs, pagination params (`page`, `limit` with hard cap)
- [ ] Retrofit pagination onto existing list endpoints (clubs, joueurs, matchs, arbitres)
- [ ] Choose + configure test stack (Vitest + mongodb-memory-server; Playwright later) — first tests: validators + auth helpers
- [ ] `docs/disciplinary-rules-sources.md` — created, seeded with Code Disciplinaire Juillet 2025 references (research pass before Phase 3 coding)

---

## Phase 2 — Core competition workflow (seasons → journées → results → standings)

### Services
- [ ] `RoundService` — create/generate rounds, completion detection (§10.9: complete when all matches OFFICIAL or explicitly postponed/cancelled/abandoned/replay)
- [ ] `ScheduleGenerationService` — round-robin (single + home/away), conflict validation (same club twice in round/time, identical home/away, duplicate fixture, non-member club); never silently overwrite an existing calendar
- [ ] `MatchFinalizationService` — **the critical piece**: transactional, idempotent (processingVersion + status guard), concurrency-safe (atomic status transition via findOneAndUpdate precondition); validates score vs goal events; triggers discipline processing (Phase 3 hooks), standings rebuild, notifications, audit
- [ ] `MatchCorrectionService` — reopen with mandatory reason: reverse/rebuild derived effects deterministically from events
- [ ] `StandingsService` — `rebuildCompetitionStandings()`: from OFFICIAL match results, configurable points, forfeit scores, tie-breakers (POINTS → H2H → GD → GS → FAIR_PLAY, configurable order), stable sort; cached snapshot collection `Standings` with `calculatedAt` + version
- [ ] Deprecation notes on `MatchService.homologuerMatch`/`updateClassement` (keep files, mark superseded)

### Admin APIs (thin handlers over services)
- [ ] `api/admin/seasons` (+`[id]`) — full CRUD, activate-current, complete, archive, end-of-season card clearance trigger (Phase 3)
- [ ] `api/admin/competitions` (+`[id]`, `/standings`, `/rebuild-standings`)
- [ ] `api/admin/rounds` (+`[id]`, `/finalize`)
- [ ] `api/admin/matches` rework (+`[id]`, `/events`, `/finalize`, `/reopen`, `/reschedule`) — keep legacy `matchs` routes working during transition, then alias
- [ ] `api/admin/users` — create club admin, activate/suspend, reset password, require password change

### Admin pages
- [ ] `/admin/seasons` + `[id]` (tabs: overview, competitions, discipline summary, clearance history, audit)
- [ ] `/admin/competitions` + `[id]` workspace (tabs: overview, journées, matches, standings, clubs, discipline, statistics, rules, audit)
- [ ] `/admin/competitions/[id]/rounds` + `[roundId]` — **the flagship result-entry page**: match grid, bulk score entry, per-match drawer (goals/cards/notes/document), save drafts, finalize selected, finalize journée, filters
- [ ] `/admin/matches` list w/ filters + `/admin/matches/new` + `/admin/matches/[id]` (tabs: overview, goals, cards, discipline impact, audit; actions: finalize/reopen/reschedule/postpone/abandon/forfeit/replay with confirmations)
- [ ] `/admin/users`
- [ ] Rework `/admin/classement` → standings page w/ rebuild button + calculatedAt + export stub
- [ ] Shared components batch 1: PageHeader, DataTable (server pagination), FilterBar, StatusBadge, ConfirmationDialog, EmptyState/ErrorState, SeasonSelector, CompetitionSelector, StatCard, FormDrawer

### Tests
- [ ] Unit: fixture generation, standings calc + tiebreakers, finalization idempotency
- [ ] Integration: create match → enter result → finalize → duplicate finalize rejected → reopen → standings consistent
- [ ] Concurrency: two simultaneous finalize calls → exactly one succeeds

---

## Phase 3 — Discipline engine (the product's heart)

**Prerequisite:** research pass recorded in `docs/disciplinary-rules-sources.md`.

### Services
- [ ] `DisciplineEngine` — orchestrator invoked by MatchFinalizationService inside the same transaction
- [ ] `YellowCardAccumulationService` — official-match filter, threshold from active RuleSet, auto-suspension creation, cards → CONSUMED_BY_SUSPENSION, same-match yellow+red replacement rule, last-match-of-competition carryover, season-end clearance (auditable status op)
- [ ] `RedCardDecisionService` — provisional suspension on red, pending-decision queue, final decision recording (N matches / until date / cancelled / reduced), deduction of already-missed eligible matches
- [ ] `SuspensionService` — serving engine + ledger writes (unique constraint), scope evaluation, cross-season carryover, SERVED transition, manual corrections w/ reason
- [ ] `EligibilityService` — per player + per upcoming match availability (replaces/absorbs `DisciplineService.getPlayerAvailabilityForMatch`)
- [ ] Anomaly detection: SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT, duplicate card, score≠goals, suspension double-decrement, official match w/o discipline processing, wrong-club card
- [ ] `NotificationService` — in-app first; triggers per spec §21; dedupe on finalization retry

### APIs
- [ ] `api/admin/discipline/cards`, `/suspensions` (+`[id]`), `/red-decisions`, `/anomalies`
- [ ] `api/admin/notifications`

### Admin pages
- [ ] `/admin/discipline` dashboard (KPIs: active/provisional suspensions, pending red decisions, 2-yellow players, auto suspensions, served)
- [ ] `/admin/discipline/yellow-cards`, `/red-cards`, `/suspensions` (+`[id]` with full ledger/audit/actions), `/anomalies`
- [ ] `/admin/players` + `[id]` (disciplinary timeline, serving ledger, stats tabs) — evolve existing `/admin/joueurs`
- [ ] `/admin/notifications`
- [ ] Components batch 2: CardBadge, SuspensionBadge, EligibilityBadge, MatchTimeline, AuditTimeline, NotificationItem, RoundProgress

### Tests (edge cases from spec §18 — the full list is the acceptance suite)
- [ ] 1st/2nd/3rd yellow across matches → auto suspension; consumed cards never reused
- [ ] 3rd yellow in last competition match → carries forward
- [ ] Yellow + second-yellow-red same match ≠ two accumulation yellows
- [ ] Red → provisional → decision shorter/longer than already-missed matches
- [ ] Postponed/cancelled/never-started/abandoned/forfeit matches vs ledger counting
- [ ] Double card entry, double finalize, double decrement all rejected
- [ ] Reopen after suspension generated → deterministic rebuild
- [ ] Season-end clearance auditable; cross-season carryover; club-change with active suspension

---

## Phase 4 — Club portal (fully scoped, read-only)

**Rule: clubId always derived from session. Never trust client input.**

- [ ] `api/club/*`: dashboard, players (+`[id]`), matches (+`[id]`), cards, suspensions, eligibility, standings, notifications, profile
- [ ] Pages: `/club/dashboard` (rework existing), `/club/players` (+`[id]`), `/club/matches` (+`[id]`), `/club/calendar`, `/club/cards`, `/club/suspensions`, `/club/eligibility` (per-upcoming-match view), `/club/standings` (own club highlighted), `/club/notifications` (mark read), `/club/profile` (password change)
- [ ] Update `components/Sidebar.tsx` club links to the real set (§13); remove dead links
- [ ] No edit affordances on sporting data anywhere in club portal; opposing-club confidential notes never exposed
- [ ] Authorization tests: cross-club player access denied, club-admin hitting admin APIs denied, disabled user denied, unauthenticated denied

---

## Phase 5 — Operations layer

- [ ] `ReportService` + `/admin/reports` + `/club` report downloads — CSV/Excel (clean columns, correct dates), PDF w/ federation header/season/competition/date/page numbers (§20 report list)
- [ ] `/admin/audit` — read-only audit browser w/ filters (user, club, action, entity, date, competition, match)
- [ ] `/admin/settings` — org info, current season, defaults, disciplinary rule configuration UI (versioned rule sets), notification templates, security settings, upload limits, language/timezone
- [ ] Global admin search (player/licence/club/match/competition/suspension) — debounced, server-side
- [ ] CSV imports (clubs, players, fixtures, results): upload → validate → error preview → confirm → process → report; downloadable templates
- [ ] Document storage decision: private disk volume vs S3/MinIO (see Questions); private access checks on download
- [ ] Localization structure (French strings centralized; AR/RTL-ready); `Africa/Tunis` display formatting helper

---

## Phase 6 — Production readiness

- [ ] Dockerfile review (uploads volume vs standalone output), healthcheck endpoint `/api/health`
- [ ] Compose: replica set (done Phase 0), restart policies, no hardcoded creds, mongo not publicly exposed
- [ ] Security headers (next.config), secure cookie config, session maxAge
- [ ] CI: tsc + lint + tests + build (GitHub Actions)
- [ ] Production admin bootstrap script (no seeded demo users)
- [ ] Realistic dev seed v2: 1 FTF admin, 8+ clubs w/ club admins, 18+ players/club, active season, league competition, rounds, mixed match states, cards/suspensions exercising the engine
- [ ] Docs: `docs/deployment.md`, `docs/backup-and-restore.md`, `docs/security.md`, `docs/user-guide-admin.md`, `docs/user-guide-club.md`; fill or remove empty INSTALLATION/QUICKSTART/START_HERE placeholders (ask before removing)
- [ ] E2E (Playwright): full yellow-card journey (season→competition→clubs→players→rounds→results→3 yellows→suspension→club sees it→next match served→available) + red-card journey

---

## Sprint 1 (immediate) — security + one end-to-end vertical slice

Goal: platform is safe, and the **yellow-card workflow works end-to-end** on a thin path.

1. All of **Phase 0** (P0 items)
2. Phase 1A (roles migration) + 1D validators/audit minimal (`AuditService.log` + zod on match/event routes)
3. Minimal `Round` model + attach existing matches via migration (derive from `journee` number)
4. `MatchFinalizationService` v1 (transactional, idempotent) + `api/admin/matches/[id]/finalize` + finalize button on match detail page
5. `YellowCardAccumulationService` v1 + `Suspension` + `DisciplinaryCard` + ledger models (hardcoded-config → RuleSet doc in same sprint if time allows)
6. `SuspensionService.processMatchServed()` v1 wired into finalization
7. Club dashboard shows real suspensions + remaining matches from new models
8. Tests: finalize idempotency, 3-yellow auto-suspension, ledger uniqueness

Deliverable: admin enters cards on a match → finalizes → suspension auto-created → club sees it → next finalized match serves it. Audited throughout.

---

## Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | Keep French model names (Joueur, Saison, Club); new models in English | Minimize migration risk; renames are cosmetic, integrity work is not |
| D2 | `organizationId` added in Phase 1 via backfill migration, required thereafter | Spec allows staged migration; doing it early is cheaper than later |
| D3 | Embedded `Competition.classement` deprecated in place, replaced by `Standings` snapshot collection + rebuild | Embedded array is uninitialized dead weight; snapshot is rebuildable |
| D4 | Single-node replica set for dev Mongo | Required for transactions; production needs real replica set (document in deployment.md) |
| D5 | Legacy `matchs` API routes kept as aliases during transition to `matches` | Existing admin pages depend on them; no big-bang rename |
| D6 | `MatchService`/`DisciplineService` marked deprecated, not deleted | User rule: never delete code without agreement; they also document prior intent |
| D7 | In-app notifications first; email only if SMTP config provided | Spec §21 |
| D8 | Licence/Transfert models frozen as future modules | Spec §6 out-of-scope |

## Open questions (cannot be answered from the repo)

1. **Rotate secrets**: the Atlas URI in `.env.local` is live and committed — has this repo ever been pushed to a remote? (Determines whether history purge is needed.)
2. **Document storage**: local Docker volume acceptable for v1, or is S3/MinIO available? (Affects Phase 5 upload design.)
3. **Rule confirmation**: does the FTF Code Disciplinaire (Juillet 2025) remain the applicable edition for the target season, and do you have the PDF to place under `docs/` for article-level citation?
4. **Existing data**: is there any real (non-seed) data in the Atlas database that migrations must preserve, or can dev DB be rebuilt freely?
5. **SMTP**: available for email notifications, or in-app only for v1?
