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
/api/admin/notifications          GET history/statistics · POST send manual notification
/api/admin/notifications/[id]     GET delivery details
/api/admin/notifications/[id]/duplicate POST return/create a new prefilled draft intent (never resend silently)
/api/admin/notifications/[id]/archive   POST archive admin history state
/api/admin/reports                GET report catalog · POST generate/export
/api/admin/audit                  GET (read-only, filters)
/api/admin/settings               GET · PUT

/api/admin/referees                       GET (search/filter/paginate) · POST
/api/admin/referees/[id]                  GET · PUT · archive/status actions
/api/admin/referees/[id]/assignments      GET upcoming/previous (FTF_ADMIN)

/api/admin/matches/[id]/officials         GET internal history · PUT save draft
/api/admin/matches/[id]/officials/publish POST { version, reason? }
/api/admin/matches/[id]/officials/cancel  POST { version, reason }
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
/api/club/notifications              GET own-club center (filters + pagination)
/api/club/notifications/[id]/read    PUT mark own delivery read
/api/club/notifications/read-all     PUT mark all own deliveries read
/api/club/profile          GET · PUT own account · PUT password
```

Club dashboard and match responses include only a `publishedOfficials` public DTO when the current assignment is `PUBLISHED` or `UPDATED`. It contains display names, roles, main-referee category, and publication date only. `DRAFT`/`CANCELLED`, notes, contact data, audit history, actor IDs, and change reasons are omitted.

## 3. Existing routes — disposition

| Existing route | Disposition |
|---|---|
| `api/admin/clubs`, `clubs/[id]` | **Adapt**: zod, pagination, soft archive instead of DELETE, audit |
| `api/admin/joueurs` | **Adapt** then alias → `players` namespace; soft archive; licence uniqueness handling |
| `api/admin/arbitres` | Reuse behind canonical `api/admin/referees`; keep as a temporary authenticated alias during migration, then deprecate |
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
| `NotificationService` | Automatic + manual in-app notifications; transactional recipient fan-out, recipient read state, delivery statistics, organization-scoped dedupe/idempotency; email later if SMTP | Extend existing service, do not duplicate it |
| `AuditService` | `log()` immutable entries with actor/before/after/reason/requestId | Wired into every sensitive mutation |
| `ReportService` | CSV/Excel/PDF generation per report catalog | Phase 7 |

Deprecated (kept with `@deprecated` headers, not deleted): `MatchService.homologuerMatch`, `MatchService.updateClassement`, `DisciplineService.decrementerSuspensions` (naive decrement violates the ledger rule).

### RefereeAssignmentService (planned)

Owns draft saving, role uniqueness, referee eligibility/status checks, match/round/date validation, scheduling conflicts, versioning, publication/cancellation transactions, notification fan-out, and audit. Routes must not implement this workflow directly.

- Save draft: FTF_ADMIN only; zod allowlist; organization-scoped match and referees; no club notification.
- Publish: atomically validate the requested version, require the main referee, lock the published version, audit, and upsert one notification per participating club.
- Change published assignment: mandatory reason; create version `n + 1`; preserve version `n`; use `REFEREE_ASSIGNMENT_UPDATED`.
- Cancel: mandatory reason; preserve history; use `REFEREE_ASSIGNMENT_CANCELLED`.
- Dedupe key: `<TYPE>:<matchId>:<assignmentVersion>:<recipientClubId>`.

## 6. Referee API security and response contracts

- Every admin endpoint calls `requireAdmin()` and filters by `organizationId`; object IDs alone never authorize access.
- Every club endpoint calls `requireClub()`, constrains matches to `homeClubId/awayClubId === session clubId`, and builds an explicit allowlisted response object. Never spread/serialize the full Mongoose `Match` document.
- Club APIs never return `Match.notes`, `rapportArbitre`, `feuilleMatchElectronique`, assignment notes/history/reasons/actors, referee contact details, availability notes, or drafts.
- Publishing uses a transaction or equivalent idempotent compare-and-swap; unique version and notification dedupe indexes are hard backstops.
- Conflicts are checked across all four role fields and all active published/updated assignments in the organization. A database/service race test is required; UI warnings are not enforcement.
- Current audit finding and prerequisite: `/api/club/matches/[id]` spreads the complete match and populates `arbitrePrincipalId` unconditionally, while dashboard/list endpoints return broad match documents. These routes must move to public DTO projection before referee publication is enabled.

## 7. Concurrency & idempotency contract

- Finalize claim: `Match.findOneAndUpdate({ _id, status: 'PLAYED_PENDING_VALIDATION' }, { $set: { status: 'OFFICIAL', ... }, $inc: { processingVersion: 1 } }, { session })` — second/concurrent caller finds no document to claim → returns "already finalized" without side effects.
- All downstream writes (cards, suspensions, ledger, standings, notifications, audit) happen in the **same MongoDB transaction**; failure rolls everything back and releases the claim.
- Ledger unique index `(suspensionId, matchId)` is the hard backstop against double serving.
- Notification `dedupeKey` (e.g. `SUSPENSION_CONFIRMED:<suspensionId>`) is the backstop against duplicate notifications.

## 8. Manual club-notification API contract (planned)

### 8.1 Admin create and history

`POST /api/admin/notifications` requires `FTF_ADMIN`, an organization-scoped `Idempotency-Key` header, and this zod-validated JSON body:

```ts
{
  targetType: "ALL_ACTIVE_CLUBS" | "SINGLE_CLUB" | "MULTIPLE_CLUBS";
  clubId?: string;
  clubIds?: string[];
  category: ManualNotificationCategory;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  title: string;                 // trim, min 3, max 150
  message: string;               // trim, min 3, max 5000
  actionLabel?: string;
  actionUrl?: string;
  expiresAt?: string;
}
```

- `ALL_ACTIVE_CLUBS`: ignore any client IDs and resolve `Club.status === ACTIVE` within `session.user.organizationId` on the server.
- `SINGLE_CLUB`: exactly one active, same-organization club.
- `MULTIPLE_CLUBS`: at least one active, same-organization club; reject duplicate IDs with a clear validation error.
- `actionLabel` and `actionUrl` are both present or both absent. URL validation rejects schemes, protocol-relative URLs, backslashes, control characters and traversal, then matches an allowlist such as `/club/matches/<ObjectId>`, `/club/suspensions`, `/club/standings`, `/club/notifications` and other deliberately registered club routes.
- `expiresAt`, when supplied, parses as a valid date strictly in the future.
- Content is stored and returned as plain text. Clients render message line breaks with text semantics/CSS, never `dangerouslySetInnerHTML`.

The service starts a MongoDB transaction, creates the immutable parent notification, bulk-inserts one recipient row per authoritative club, and writes the audit entry in the same transaction. Any recipient failure rolls back the whole send; the response never reports success for partial delivery.

`GET /api/admin/notifications` supports source, target type, club, status, category, date range and escaped text search, plus pagination/sorting. Statistics are aggregated from `NotificationRecipient`, including recipient/read/unread counts. Detail responses may expose the recipient list only to `FTF_ADMIN`. Archive does not edit content or remove club delivery. Duplicate creates a new editable intent/prefill and requires a separate preview/confirmation/send; it never silently delivers.

### 8.2 Club read APIs

All club routes call `requireClub()` and derive `clubId` from the session. Queries join/filter through `NotificationRecipient { clubId, organizationId }`; no club ID is accepted from the request.

- GET returns only the authenticated club's recipient rows and safe parent fields. It supports unread, priority and category filters and excludes `ADMIN_ONLY`.
- PUT `[id]/read` atomically sets `readAt/readBy` only where both notification recipient ID and session club match; another club receives 404/403 without existence leakage.
- PUT `read-all` updates only unread rows for the session club and organization.
- Expired items remain in history with `expired: true` but are not returned as active dashboard highlights.

### 8.3 Duplicate-delivery prevention

- Unique `(notificationId, clubId)` prevents two recipient rows for one send.
- Unique sparse `(organizationId, dedupeKey)` protects automatic event retries.
- Unique sparse `(organizationId, idempotencyKey)` protects manual POST/network retries.
- The idempotency response returns the original notification/recipient count for the same key and rejects reuse with a different normalized payload.

### 8.4 Current implementation audit and migration prerequisites

- Current `Notification` duplicates content and read state per recipient; this is migrated, not discarded.
- Current `NotificationService.notify()` and its automatic callers are reusable after it writes parent + recipient records.
- Current club PUT is correctly session-scoped, but it is replaced by resource/read-all routes and recipient-row updates.
- Current admin page incorrectly calls the club mark-read endpoint and sends `id` instead of `notificationId`; admin history must have no mark-read action.
- Current admin GET cannot provide per-club read statistics, and its unread count is based on parent documents/admin-only records.
- Club dashboard unread queries need both organization scope and recipient rows, plus expiration-aware highlight selection.

## 9. Official match workspace API contract (planned; approval gated)

### 9.1 Canonical endpoints

All admin endpoints call `requireAdmin()`, derive `organizationId` from the session, validate the ObjectId and body with zod, query by `{ _id, organizationId }`, propagate a request ID, and return a stable allowlisted DTO.

| Method | Route | Contract |
|---|---|---|
| GET | `/api/admin/matches/[id]` | Workspace header/overview plus transition permissions and per-tab counts; never recompute/overwrite stored score during read |
| PUT | `/api/admin/matches/[id]` | Edit draft match metadata/result with optimistic version; official match returns 409 |
| GET/POST | `/api/admin/matches/[id]/events` | List active/cancelled canonical events; create a draft goal/card using `clientMutationId` |
| PUT/DELETE | `/api/admin/matches/[id]/events/[eventId]` | Edit draft event or reasoned soft-cancel; no physical delete after use |
| GET | `/api/admin/matches/[id]/discipline-impact` | Derived cards, accumulation, suspensions, ledger changes, anomalies, notices, next affected match |
| POST | `/api/admin/matches/[id]/finalize` | Transactional/idempotent finalize with score override/anomaly confirmations when required |
| POST | `/api/admin/matches/[id]/reopen` | Mandatory reason; deterministic reversal/replay of all derived effects |
| GET | `/api/admin/matches/[id]/audit` | Match/entity-related immutable history using the existing audit projection |
| GET | `/api/admin/matches/[id]/report` | Official-match report/export assembled through `ReportService`; draft returns 409 |

`/api/admin/matchs/[id]` and its embedded `/events` handler remain read/write compatibility aliases only during migration. New UI calls the canonical English namespace; aliases delegate to the same service and validator rather than maintain separate behavior.

### 9.2 Event and finalization service flow

```text
route validation + auth/org scope
  -> MatchWorkspaceService saves draft aggregate/events
  -> MatchFinalizationService loads aggregate + applicable RuleSet
  -> validates clubs/players/assists, score/goals, cards, anomalies, version
  -> one transaction: official state + cards + suspensions + ledger + durable outbox + audit
  -> idempotent projection worker/reconciler: standings + player stats + notifications
```

Required effects must never be swallowed. If discipline is synchronous in the finalization transaction, its exception aborts the transaction. If a projection is deferred, the transaction writes a durable uniquely keyed outbox/reconciliation record; `setImmediate` is not a delivery guarantee. Every derived card uses unique `sourceEventId`; every notification uses the Phase 10 recipient-aware dedupe contract; every ledger decision and suspension decrement is atomic.

`FinalizeMatchInput` carries `expectedProcessingVersion`, optional score-override data, and explicit anomaly confirmations. A mismatch returns 422 with structured expected/actual totals. A duplicate retry returns the original official result. A competing stale write returns 409. Event creation never changes match status to finished or official.

### 9.3 Reopen and rebuild contract

`MatchCorrectionService` becomes the sole correction orchestrator. It records the reason, reverses or replay-rebuilds cards/accumulations, red decisions that derive from the match, suspensions, serving ledger, eligibility, statistics, standings, and notification corrections before exposing a consistent draft. It must retain cancelled/source events and immutable audit history. The current standings-only rebuild is explicitly incomplete and must remain release-blocked for matches with discipline effects.

### 9.4 Club DTO and dependency boundaries

`GET /api/club/matches/[id]` first scopes the match to the session club in the database query, then maps an allowlisted DTO. It must not spread the Mongo match document, expose `notes`, `rapportArbitre`, score overrides, draft/cancelled events, audit data, opponent eligibility, or unpublished officials. It must not recalculate scores on read. Queries for cards, suspensions, rules, and players include organization/season/competition scope.

Officials data comes from Phase 9 published assignments; legacy `arbitrePrincipalId` is read-only fallback until migration. Club delivery/read details come from Phase 10 `NotificationRecipient`. The workspace may call these contracts but may not duplicate them.

### 9.5 Current-route audit findings

- `app/api/admin/matchs/[id]/route.ts` and `.../events/route.ts` query by ID without organization scope. The detail GET derives score from plain embedded goals, which destroys forfeit/administrative semantics in the response.
- The legacy event POST/PUT silently sets `statut = Terminé` after a goal, has no GET, does not validate player membership or duplicates, cannot edit minute/type, and physically deletes events.
- Sprint 11.1 makes discipline, serving ledger/decrement, automatic discipline notifications, officialization, and audit one transaction. Standings/round completion use durable `MatchProjectionTask` records and retry on repeated finalization; a general background drain remains a production-worker follow-up.
- Sprint 11.1 makes correction fail closed for any match with cards, source suspensions, or serving entries; discipline-free reopening is transactional. Full event-sourced correction remains blocked on Sprint 11.2 canonical events. Organization scope was added to the audit, eligibility, serving, rule-selection, standings and round paths touched by this flow.
- The legacy `DisciplineService` uses the old `Discipline` model and naive global decrement/modulo logic; it is deprecated compatibility code and must not be called by the workspace. Reuse and harden `DisciplineEngine`, `YellowCardAccumulationService`, `SuspensionService`, `EligibilityService`, and `RedCardDecisionService` instead.
- `GET /api/admin/audit` is reusable but must add organization scope before embedding its projection. `ReportService` already supplies CSV infrastructure but not a match-sheet report.
- `app/api/admin/discipline/anomalies` detects only electronic-lineup participation and performs N+1 dynamic scans; event-recipient anomalies need stable persisted review state.
