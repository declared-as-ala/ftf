# CLAUDE.md — FTF Platform

Persistent project instructions for Claude Code. Treat the source code as the source of truth; this file records decisions, conventions and known traps.

## Documentation map (read in this order when resuming)

1. **[docs/progress.md](docs/progress.md)** — where we stopped; **must be updated after every batch** (task table + batch log: modified files, tests run, remaining issues, next batch)
2. [docs/implementation-roadmap.md](docs/implementation-roadmap.md) — phases → sprints → batches (authoritative execution order)
3. [docs/product-specification.md](docs/product-specification.md) — authoritative product spec (workflows, pages, permissions, edge-case acceptance criteria)
4. [docs/architecture-audit.md](docs/architecture-audit.md) — current-state audit + feature completion matrix
5. [docs/database.md](docs/database.md) — target models, indexes, migrations · [docs/api.md](docs/api.md) — API surface & services · [docs/security.md](docs/security.md) — vulnerabilities & controls · [docs/testing.md](docs/testing.md) — test catalog · [docs/ui-ux.md](docs/ui-ux.md) — design direction · [docs/disciplinary-rules-sources.md](docs/disciplinary-rules-sources.md) — rule traceability (check before coding any disciplinary rule)

`NEXTSTEP.md` is the superseded roadmap seed — don't update it; update `docs/progress.md`.

## 1. What this project is

**FTF** is a centralized football competition and disciplinary management SaaS for the Fédération Tunisienne de Football, being transformed from an unfinished prototype into a production-ready platform.

**Core loop:** FTF admin creates seasons → competitions → journées (rounds) → fixtures. After matches are played, the FTF admin enters results, goals and cards. The system automatically processes yellow-card accumulation, creates suspensions, tracks suspension serving via a ledger, computes eligibility, rebuilds standings, notifies clubs, and audits everything.

**Two roles only:**

```ts
type UserRole = "FTF_ADMIN" | "CLUB_ADMIN";
```

- `FTF_ADMIN` — enters all official data (results, goals, cards, decisions). Full federation access.
- `CLUB_ADMIN` — **read-only consultation** scoped to their club: players, matches, cards, suspensions, eligibility, standings, notifications. Can only edit own account/password and mark notifications read.

**Explicitly OUT of scope (do not build):** referee role/portal, electronic match-sheet workflow, VAR, live entry, ticketing, payments/billing, fan/player/coach accounts, complex transfer/licence workflows, public website. Existing `Licence`/`Transfert` models are frozen as future modules — do not delete, do not extend.

## 2. Stack (preserve and improve)

Next.js 16 App Router · React 19 · TypeScript strict · MongoDB + Mongoose 8 · NextAuth v5 (credentials, JWT) · bcryptjs · Tailwind v4 · shadcn-style components (`components/ui/`) · react-hook-form + zod (installed, **currently unused — must be adopted**) · Recharts · Docker/Compose.

Commands: `npm run dev` · `npm run build` · `npm run seed` (tsx scripts/seed.ts) · `npm run lint`.
**Verify with `npx tsc --noEmit`, not repeated `next build`** (user preference).

## 3. Repository map (audited state)

```
lib/
  auth.ts                NextAuth config (JWT: role, clubId, clubName, clubLogo)
  db.ts                  cached mongoose connection
  models/                Club, Joueur, Staff, Arbitre, Match, Competition,
                         Saison, Discipline, Licence, Transfert, User, Evenement
  services/
    discipline.service.ts  yellow/red processing, availability (partially reusable)
    match.service.ts       homologuerMatch + updateClassement  ← DEAD CODE, never called by any route
middleware.ts            role routing /admin ↔ /club (matcher EXCLUDES /api)
app/
  admin/                 dashboard, clubs(+[id]), joueurs, matchs(+[id]), arbitres, classement
  club/                  dashboard ONLY (sidebar links to 7 pages that 404)
  api/admin/             arbitres, clubs(+[id]), competitions, joueurs,
                         matchs(+[id], events, availability), saisons, standings
  api/auth/[...nextauth]
  login/, clear-cookies/ (dev workaround page)
components/              Navbar, Sidebar, PlayerAvailability, Loader, LoadingButton, ui/*
hooks/usePlayerAvailability.ts   ← unused (component fetches directly)
scripts/seed.ts          wipes entire DB unconditionally, hardcoded demo creds
docker-compose.yml       standalone mongo:7 (NO replica set → NO transactions), hardcoded creds
```

## 4. Known traps & audit findings (do not reintroduce)

1. **Secrets are committed**: `.env.local` holds a live Atlas URI + NEXTAUTH_SECRET. Must be rotated; create `.env.example`. `lib/auth.ts` has a fallback secret string — remove.
2. **`lib/models/Arbitre.ts` has a real TS error**: interface declared `Arbitre` but used as `IArbitre` (Schema/Model generics). `tsc --noEmit` fails.
3. **Homologation is dead code**: `MatchService.homologuerMatch()` and `DisciplineService` card processing are never invoked from any API route. Cards recorded in matches currently produce **no** discipline records. Seed marks matches `homologue: true` directly.
4. **Two competing standings implementations**: embedded `Competition.classement` (updated only by dead `updateClassement`, never seeded/initialized → silently no-ops) vs dynamic recompute in `/api/admin/standings`. Neither handles forfeits, deductions, head-to-head, reopening.
5. **Events route side-effects**: `POST /api/admin/matchs/[id]/events` auto-flips status to `Terminé` when a goal is assigned, recalculates score from goals; no check against finalized matches — events can be edited after homologation with zero reversal.
6. **No transactions possible**: docker-compose mongo is standalone. MongoDB transactions require a replica set (single-node `rs.initiate` works for dev).
7. **No zod, no react-hook-form, no tests, no pagination anywhere** (all `.find()` unbounded), no audit logging, no rate limiting, no user status/lockout.
8. **File uploads unsafe**: admin routes write to `public/uploads/*` using client-supplied extension, no MIME/size validation. Also incompatible with `output: standalone` in production.
9. **Login page hacks**: clears all cookies via JS on submit; renders demo credentials in the UI. `/clear-cookies` page exists. Remove for production.
10. **Middleware excludes `/api`** — fine, but that means EVERY route must self-authorize (admin routes currently do check `role !== 'ADMIN'`; there are zero `/api/club/*` routes yet).
11. **Naming is mixed** French/English (`Joueur`, `matchs`, `classement` vs `standings`). See conventions below.
12. `INSTALLATION.md`, `QUICKSTART.md`, `START_HERE.md` are empty placeholder files.

## 5. Domain rules — disciplinary baseline (Tunisia)

Authoritative source: **FTF Code Disciplinaire (latest found: Edition Juillet 2025)** — re-verify before implementing each rule; record every implemented rule in `docs/disciplinary-rules-sources.md` (document, edition, article, interpretation, config flag, assumptions). **Never invent a rule; ambiguous ⇒ configurable + documented assumption.**

Rules are stored in versioned **`DisciplinaryRuleSet`** documents (per season/competition/category), never hard-coded in services. Historical seasons keep their original rule version.

### Yellow cards
- 3 warnings across 3 **official** matches ⇒ automatic 1-match suspension for the next applicable official match (threshold + matches configurable). Friendlies never count (`isOfficial` on competition/match).
- Trigger cards are marked `CONSUMED_BY_SUSPENSION` and can never feed a second suspension. Never delete card history — use `CardAccumulationStatus: ACTIVE | CONSUMED_BY_SUSPENSION | CANCELLED | CLEARED_AT_SEASON_END`.
- Third yellow in the final match of a competition ⇒ suspension carries to the first applicable official match that follows (possibly next season).
- Season end: remaining 1st/2nd warnings cleared as an **auditable operation** (status change, not deletion).

### Red cards
- `CardType: YELLOW | SECOND_YELLOW_RED | DIRECT_RED`. A second-yellow dismissal is ONE event — it must not create two accumulation yellows.
- Red entered ⇒ **provisional suspension immediately** (player unavailable) ⇒ case sits in "Pending Red Decisions" ⇒ FTF admin records the final decision (N matches / until-date / cancelled / reduced / already served). Eligible matches missed before the decision are deducted. **Never auto-assume 1 match.**
- If a player got a yellow then a red in the same match, the yellow must not continue in accumulation when the rule says the graver offence replaces it.

### Suspension serving — the ledger
Never blindly decrement `remainingMatches`. A **`SuspensionServiceEntry`** ledger records, per (suspension, match): counted or not + reason (`OFFICIAL_MATCH_PLAYED`, `NO_KICKOFF_DOES_NOT_COUNT`, `FORFEIT_COUNTS`, `CLUB_ABSENT_DOES_NOT_COUNT`, `WRONG_COMPETITION`, `WRONG_CATEGORY`, `ALREADY_COUNTED`, `MANUAL_CORRECTION`, …), remainingBefore/After, processedAt/By. **Unique index on (suspensionId, matchId)** — a match can never be counted twice. Postponed/cancelled/never-started matches don't count; forfeit rules per official regulation; scope checks (`SAME_COMPETITION | SAME_CATEGORY | ALL_OFFICIAL_COMPETITIONS`). Suspension keeps `totalMatches` + `servedMatches` + `remainingMatches`, status `PENDING_DECISION | PROVISIONAL | ACTIVE | SERVED | CANCELLED | OVERTURNED | EXPIRED`.

### Anomalies
Suspended player appearing as scorer/carded ⇒ raise `SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT` anomaly for admin review; sanctions applied only by explicit FTF decision, never automatically.

## 6. Architecture conventions (target)

- **Thin route handlers → domain services.** Business logic lives in `lib/services/*`; routes do auth + zod parse + service call + sanitized response.
- **Services (planned):** `MatchFinalizationService`, `MatchCorrectionService`, `DisciplineEngine`, `YellowCardAccumulationService`, `RedCardDecisionService`, `SuspensionService`, `EligibilityService`, `StandingsService`, `RoundService`, `ScheduleGenerationService`, `NotificationService`, `AuditService`, `ReportService`.
- **Match finalization** is a financial-grade operation: atomic, idempotent (`processingVersion`), transactional (requires replica set), concurrency-safe, audited, reversible via a deterministic **rebuild-from-events** mechanism (reopen ⇒ reverse/rebuild accumulations, suspensions, ledger, standings, stats — never naive deletes).
- **Standings**: match results are the source of truth; cached/snapshot standings must always be rebuildable via `StandingsService.rebuildCompetitionStandings()`. The embedded `Competition.classement` array will be deprecated.
- **Authorization**: middleware is routing sugar only. Every API route and service enforces RBAC + object-level checks. Club routes (`/api/club/*`) derive `clubId` **from the session, never from the client**. Cross-club access ⇒ 403/404.
- **Validation**: zod schemas on the server for every mutating route (`lib/validators/`). react-hook-form + zodResolver on the client.
- **Audit**: every integrity-sensitive mutation writes an immutable `AuditLog` (actor, action, entity, before/after, reason, requestId). Corrections/cancellations require a mandatory reason.
- **SaaS boundary**: `organizationId` on all major records (staged migration — see NEXTSTEP Phase 1); seed one org "Fédération Tunisienne de Football". No billing.
- **Multi-tenancy queries** must always filter by `organizationId` once introduced.

## 7. Data & naming conventions

- **New models in English** (Round, MatchEvent, DisciplinaryCard, Suspension, DisciplinaryRuleSet, Notification, AuditLog, Organization, SuspensionServiceEntry). **Existing French models** (Joueur, Saison, Club…) are adapted in place, not renamed wholesale — renames only as part of a documented migration step with a script in `scripts/migrations/`.
- Role values migrate `ADMIN → FTF_ADMIN`, `CLUB → CLUB_ADMIN` via migration script + temporary read-compat.
- Statuses are string-literal unions (see NEXTSTEP §Models for the full target interfaces from the spec).
- Soft archival (`status: ARCHIVED`) over destructive deletes whenever history exists. Never physically delete cards, suspensions, matches with history, or audit logs.
- Unique indexes: user email per org; club `organizationId+code` and `organizationId+slug`; round `organizationId+competitionId+number`; ledger `suspensionId+matchId`; player licence per org.
- Derived stats (player goals/cards/matches) are computed from events or maintained as rebuildable counters — never the only source of truth.
- Dates stored in UTC; displayed in `Africa/Tunis`.

## 8. UI conventions

- **French UI** (default), architecture localization-ready for Arabic/RTL later (no hard-coded labels sprayed through big components — centralize strings).
- Professional federation-admin look: white/light-neutral backgrounds, charcoal/deep-navy text & nav, **Tunisian red as accent (sparingly)**, green=available, orange=at-risk, red=suspended/critical, blue=pending, gray=archived. No fan-site aesthetics, no generic template look.
- Keep and extend the existing shadcn-style kit. Planned shared components: PageHeader, Breadcrumbs, SeasonSelector, CompetitionSelector, StatusBadge, ClubAvatar, PlayerAvatar, MatchCard, ScoreDisplay, MatchTimeline, CardBadge, SuspensionBadge, EligibilityBadge, RoundProgress, DataTable, FilterBar, EmptyState, ErrorState, ConfirmationDialog, AuditTimeline, NotificationItem, StatCard, FormDrawer, DocumentViewer.
- Every page: loading/skeleton, empty, error, permission-denied, success feedback, form validation, unsaved-changes warning. Tables: server-side pagination, search, filters, sorting, responsive. Destructive/integrity actions need strong confirmation dialogs with mandatory reason where applicable.
- Accessibility: keyboard nav, visible focus, labels, accessible dialogs, semantic tables, contrast.
- Existing dark mode (next-themes) is preserved.

## 9. Security requirements (enforced, not aspirational)

Server-side RBAC + object-level authz everywhere · club data isolation · zod on server · bcrypt · login rate limiting + failed-attempt lockout (`failedLoginAttempts`, `lockedUntil`) · user `status` (ACTIVE/SUSPENDED/INVITED/DISABLED) checked at login AND in session callbacks · secure cookies + session expiry · no seeded credentials in production (seed guard on `NODE_ENV`) · sanitized errors (no stack/internal leakage) · pagination limits · mass-assignment protection (explicit field picking, already partially practiced) · NoSQL-injection safety (never pass raw client objects into queries) · safe uploads (MIME sniff, size cap, private storage outside `public/`, ownership checks on download) · no fallback secrets · security headers · request IDs · immutable audit log.

## 10. Working rules for Claude in this repo

- **Prefer additive, minimal edits. Never delete/replace user code or files without asking** (standing user preference).
- Incremental migration over rewrite. Preserve working functionality; document anything superseded (e.g., mark `MatchService.homologuerMatch` deprecated when `MatchFinalizationService` lands, don't silently remove).
- Before coding a disciplinary rule: check `docs/disciplinary-rules-sources.md`; if the rule isn't recorded there, research + record it first.
- Update `NEXTSTEP.md` checkboxes as work completes so progress survives across sessions.
- Verify changes with `npx tsc --noEmit` + targeted manual testing; add tests alongside services (testing stack chosen in Phase 1).
- Verify any external asset URL before committing (user preference); use FTF brand assets only if already in repo or supplied.
