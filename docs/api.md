# API & Service Architecture

> Pattern: **thin route handlers → domain services**. Routes do: authorize (via helpers) → zod-parse → call service → return sanitized response. Business logic never lives in a route. Club routes derive `clubId` **from the session only** — a client-provided clubId is never trusted.

## 1. Target admin API surface

```
/api/admin/seasons                GET list · POST create
/api/admin/seasons/[id]           GET · PUT · actions: activate, complete, clear-cards, archive

/api/admin/competitions           GET list (filters: season, status, search) · POST create
/api/admin/competitions/[id]      GET · PUT · archive
/api/admin/competitions/[id]/standings          GET current snapshot
/api/admin/competitions/[id]/rebuild-standings  POST (FTF_ADMIN, audited)

/api/admin/rounds                 GET (by competition) · POST create/generate
/api/admin/rounds/[id]            GET (matches + completion) · PUT
/api/admin/rounds/[id]/finalize   POST (finalize journée)

/api/admin/matches                GET (filters: season/competition/round/club/status/date/entry-state, paginated) · POST
/api/admin/matches/[id]           GET · PUT (draft edits only)
/api/admin/matches/[id]/events    GET · POST · PUT · DELETE (draft only)
/api/admin/matches/[id]/finalize  POST → MatchFinalizationService
/api/admin/matches/[id]/reopen    POST { reason } → MatchCorrectionService
/api/admin/matches/[id]/reschedule POST { scheduledAt, venue?, reason? }

/api/admin/clubs                  GET · POST        (existing — adapt)
/api/admin/clubs/[id]             GET · PUT · archive (existing — adapt; no hard DELETE)

/api/admin/players                GET (filters incl. risk/suspended, search) · POST
/api/admin/players/[id]           GET (incl. disciplinary timeline) · PUT

/api/admin/discipline/cards            GET (accumulation view)
/api/admin/discipline/suspensions      GET (filters) · POST (manual, reason required)
/api/admin/discipline/suspensions/[id] GET (incl. ledger) · PUT (amend/cancel/overturn — reason required)
/api/admin/discipline/red-decisions    GET pending · POST decision
/api/admin/discipline/anomalies        GET

/api/admin/users                  GET · POST create club admin · PUT status/reset/require-change
/api/admin/notifications          GET sent list
/api/admin/reports                GET report catalog · POST generate/export
/api/admin/audit                  GET (read-only, filters)
/api/admin/settings               GET · PUT
```

## 2. Target club API surface (all scoped by session clubId)

```
/api/club/dashboard        GET aggregate
/api/club/players          GET · /api/club/players/[id] GET (403/404 if not own player)
/api/club/matches          GET (tabs) · /api/club/matches/[id] GET (participant or shared data)
/api/club/cards            GET own players' cards
/api/club/suspensions      GET active/provisional/served/history
/api/club/eligibility      GET (optional ?matchId= for per-match view)
/api/club/standings        GET competition table
/api/club/notifications    GET · PUT mark-read
/api/club/profile          GET · PUT own account · PUT password
```

## 3. Existing routes — disposition

| Existing route | Disposition |
|---|---|
| `api/admin/clubs`, `clubs/[id]` | **Adapt**: zod, pagination, soft archive instead of DELETE, audit |
| `api/admin/joueurs` | **Adapt** then alias → `players` namespace; soft archive; licence uniqueness handling |
| `api/admin/arbitres` | **Keep** as basic CRUD (out of core flows); zod later |
| `api/admin/competitions`, `saisons` | **Extend** to full CRUD per target surface |
| `api/admin/matchs`, `matchs/[id]`, `matchs/[id]/events` | **Adapt in place**, then new `matches` namespace with `matchs` kept as aliases during transition. Remove auto-`Terminé` side-effect; block mutations on finalized matches |
| `api/admin/matchs/[id]/availability` | **Keep**; later served by EligibilityService |
| `api/admin/standings` | **Supersede** by `competitions/[id]/standings` (snapshot) + rebuild endpoint; keep as read alias until UI migrates |
| `api/auth/[...nextauth]` | Keep |

## 4. Route-handler conventions

```ts
// lib/api.ts (to build)
requireAdmin(): Promise<Session>          // 401/403 + org resolution
requireClub(): Promise<{ session, clubId }> // clubId from session ONLY
apiError(status, publicMessage)           // sanitized errors — no stack/internals
withRequestId(handler)                    // request-id for audit correlation
parsePagination(searchParams)             // page/limit with hard cap (e.g. max 100)
```

- Validation: zod schemas in `lib/validators/<entity>.ts`, parsed server-side in every mutating route (mass-assignment protection = explicit field picking through zod).
- No NoSQL injection: never spread raw client objects into queries; only validated primitives.
- Mutations on integrity-sensitive entities call `AuditService.log()`.
- All list endpoints paginate; no unbounded `.find()`.

## 5. Domain services (`lib/services/`)

| Service | Responsibility | Notes |
|---|---|---|
| `MatchFinalizationService` | Transactional finalize: validate score vs events → confirm events → create DisciplinaryCards → DisciplineEngine → serving → stats → standings → notifications → audit. Idempotent via atomic status claim + `processingVersion` | Core of the product |
| `MatchCorrectionService` | Reopen with mandatory reason; deterministic reverse/rebuild of derived effects; transaction + audit | Never naive deletes |
| `DisciplineEngine` | Orchestrates the two card services inside the finalization transaction | |
| `YellowCardAccumulationService` | Count ACTIVE yellows per rule set scope; auto-create suspension at threshold; consume cards; same-match yellow+red replacement; season-end clearance | Rules from DisciplinaryRuleSet only |
| `RedCardDecisionService` | Provisional suspension on red; pending-decision queue; final decision incl. deduction of already-missed matches | Never assume 1 match |
| `SuspensionService` | Serving engine: evaluate countability per (suspension, match); write ledger (unique index); decrement; SERVED transition; manual corrections | The ledger is law |
| `EligibilityService` | Player availability globally and per upcoming match; anomaly `SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT` | Seeds from existing `DisciplineService.getPlayerAvailabilityForMatch` |
| `StandingsService` | `rebuildCompetitionStandings()`; snapshot collection; configurable points + tiebreakers; forfeits/deductions | Replaces both legacy implementations |
| `RoundService` | Round CRUD; completion detection per spec §5.9 | |
| `ScheduleGenerationService` | Round-robin generation (single/home-away); conflict validation; never overwrite existing calendar | |
| `NotificationService` | In-app notifications; dedupeKey prevents retry duplicates; email later if SMTP | |
| `AuditService` | `log()` immutable entries with actor/before/after/reason/requestId | Wired into every sensitive mutation |
| `ReportService` | CSV/Excel/PDF generation per report catalog | Phase 7 |

Deprecated (kept with `@deprecated` headers, not deleted): `MatchService.homologuerMatch`, `MatchService.updateClassement`, `DisciplineService.decrementerSuspensions` (naive decrement violates the ledger rule).

## 6. Concurrency & idempotency contract

- Finalize claim: `Match.findOneAndUpdate({ _id, status: 'PLAYED_PENDING_VALIDATION' }, { $set: { status: 'OFFICIAL', ... }, $inc: { processingVersion: 1 } }, { session })` — second/concurrent caller finds no document to claim → returns "already finalized" without side effects.
- All downstream writes (cards, suspensions, ledger, standings, notifications, audit) happen in the **same MongoDB transaction**; failure rolls everything back and releases the claim.
- Ledger unique index `(suspensionId, matchId)` is the hard backstop against double serving.
- Notification `dedupeKey` (e.g. `SUSPENSION_CONFIRMED:<suspensionId>`) is the backstop against duplicate notifications.
