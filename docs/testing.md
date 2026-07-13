# Testing Strategy

> Current state: **zero tests, no runner configured.** Target stack chosen for the existing Next.js 16 / TS / Mongoose project:
> - **Vitest** — unit + integration (fast, TS-native, works with tsx paths)
> - **mongodb-memory-server** in replica-set mode — real Mongoose models + real transactions in tests
> - **Playwright** — E2E (added in Phase 8; earlier if convenient)
> Scripts to add: `npm run test`, `npm run test:watch`. CI runs `tsc --noEmit` + lint + tests + build.

## 1. Conventions

- Tests live in `tests/` mirroring source (`tests/services/…`, `tests/api/…`) or next to the unit as `*.test.ts` — pick one at setup and stay consistent (proposal: `tests/`).
- Integration tests boot mongodb-memory-server once per suite; each test seeds its own minimal fixtures via factory helpers (`tests/factories.ts`: makeSeason, makeCompetition, makeRound, makeMatch, makePlayer, makeRuleSet…).
- Authorization tests call route handlers with mocked sessions (FTF_ADMIN / CLUB_ADMIN clubA / CLUB_ADMIN clubB / anonymous / DISABLED user).

## 2. Unit tests

| Suite | Cases | Expected |
|---|---|---|
| Yellow accumulation | 1st yellow / 2nd yellow / 3rd yellow at threshold | statuses ACTIVE→ACTIVE→auto-Suspension created; source cards `CONSUMED_BY_SUSPENSION` |
| | 4th–6th yellows (second cycle) | second suspension only after 3 NEW active cards |
| | threshold from RuleSet (e.g. 4) | suspension only at configured threshold |
| | friendly-match yellow | not counted (`isOfficial: false`) |
| | yellow + SECOND_YELLOW_RED same match | not two accumulation yellows; correct replacement |
| | season-end clearance | remaining ACTIVE cards → `CLEARED_AT_SEASON_END`, audit op recorded, nothing deleted |
| Red provisional | DIRECT_RED on finalize | Suspension status PROVISIONAL/PENDING_DECISION; player ineligible |
| Red decision | decision 3 matches, 1 already missed | remaining = 2 |
| | decision 1 match, 2 already missed | status SERVED immediately |
| | decision cancelled | suspension CANCELLED, eligibility restored, audit reason present |
| Suspension serving | eligible official match finalized | one ledger entry counted, remaining−1 |
| | remaining hits 0 | status SERVED + notification |
| | postponed / cancelled / never-started match | ledger entry `counted:false` with correct reason, remaining unchanged |
| | wrong competition (scope SAME_COMPETITION) | not counted, reason WRONG_COMPETITION |
| | same match processed twice | second insert rejected by unique index (ALREADY_COUNTED path) |
| Eligibility | active suspension | unavailable + reason |
| | 2 active yellows | available but "at risk" flag |
| Standings | W/D/L points, GD, GF ordering | configurable points honored; stable sort |
| | tiebreaker order from competition config | deterministic ranking |
| | forfeit result | forfeit score applied per config |
| | rebuild after reopen | table matches recomputation from OFFICIAL matches only |
| Fixture generation | round-robin N clubs (even/odd) | each pair once (single) / twice (home-away); no club twice per round |
| | conflicts | home=away, duplicate fixture, non-member club → validation errors |
| Match-event validation | player not in club / club not in match / own-goal crediting / totals vs score | each rejected or computed correctly |
| Rule-version selection | two RuleSet versions across seasons | historical season resolves its original version |

## 3. Integration tests (API + services + real in-memory Mongo)

| Suite | Cases | Expected |
|---|---|---|
| Match lifecycle | create → enter result → add events → finalize | Match OFFICIAL; cards created; audit entries exist |
| Duplicate finalization | finalize called twice sequentially | second returns "already finalized"; zero duplicate side effects |
| Concurrent finalization | `Promise.all([finalize, finalize])` | exactly one succeeds (atomic claim); DB consistent |
| Transaction failure | inject failure after cards, before standings | full rollback; match still finalizable; no partial writes |
| Reopen | reopen finalized match with reason | derived data rebuilt deterministically; history + audit preserved |
| Red decision flow | red → finalize → decide | PROVISIONAL→ACTIVE/SERVED transitions correct |
| Suspension correction | amend duration without reason | rejected; with reason → audit before/after recorded |
| Club-scoped APIs | `/api/club/*` as clubA admin | only clubA data; opponent confidential fields absent |
| Notifications | finalize twice | notifications created once (dedupeKey) |
| Audit | every sensitive mutation | corresponding AuditLog entry with actor/action/entity |

## 4. Authorization tests

| Case | Expected |
|---|---|
| FTF_ADMIN on any admin route | 200 |
| CLUB_ADMIN on any `/api/admin/*` route | 403 |
| CLUB_ADMIN(clubA) reads clubB player / suspension / cards | 403 or 404 — never data |
| CLUB_ADMIN write attempt anywhere (matches, players, suspensions) | 403 |
| Anonymous on any protected route | 401 |
| User with status DISABLED/SUSPENDED | login rejected; existing session invalidated on next check |
| Locked account (failed attempts) | login rejected until `lockedUntil` |
| Club route with `?clubId=other` query | parameter ignored — session club used |

## 5. End-to-end (Playwright)

**E2E-1 — Yellow-card journey:** create season → competition → add clubs → add players → generate journées → enter results → add 3 yellows to one player across 3 matches → finalize each → assert automatic suspension → log in as club admin → suspension visible with remaining=1 → finalize club's next eligible match → suspension SERVED → player available again.

**E2E-2 — Red-card journey:** red card entered → finalize → provisional suspension + pending decision visible (admin) and (club) → admin records decision (2 matches, 1 already missed → remaining 1) → club sees updated decision → next eligible match finalized → SERVED.

## 6. Seed & migration tests

- Seed refuses in `NODE_ENV=production`; with `--force` in dev produces the documented dataset.
- Each migration script is idempotent (running twice = running once) and preserves source data (assert legacy fields untouched).

## 7. Definition of done (testing) per batch

Every batch ships with: tests for its new logic green · `npx tsc --noEmit` clean · previously green suites still green · test names/results recorded in [progress.md](progress.md).

## 8. Official match workspace test matrix (planned)

These are named release criteria, not optional UI snapshots.

### 8.1 Aggregate and event validation

| Case | Expected |
|---|---|
| Goal / penalty goal | credited club score increments; scorer belongs to that participating club at match date |
| Own goal | player belongs to conceding club; opponent score increments exactly once |
| Assist validation | assist belongs to credited club and differs from scorer; invalid/cross-club IDs rejected |
| Card recipient | player belongs to selected participating club; wrong-club record rejected or persisted as a reviewable anomaly only through explicit policy flow |
| Minute bounds | normal and stoppage minutes accepted at boundaries; negative/impossible values rejected |
| Event retry | same `(matchId, clientMutationId)` returns the original event; no duplicate |
| Same player/same minute | suspicious duplicate warns; two explicitly distinct legitimate events can coexist |
| Event cancel | draft event is soft-cancelled with actor/reason; history remains; derived preview updates |
| Read detail | stored score, including forfeit/admin score, is returned unchanged; GET performs no writes/recalculation |

### 8.2 Finalization and correction integrity

| Case | Expected |
|---|---|
| Score equals structured goals | finalize succeeds and confirms one set of events/effects |
| Non-zero score, zero goals | 422 unless an allowed documented override is supplied |
| Goal mismatch | structured expected/actual error; allowed override is actor/time/reason audited |
| Inject failure in discipline | transaction rolls back match/cards/suspensions/ledger/outbox/audit |
| Sequential duplicate finalize | second response is idempotent; no duplicate card, suspension, notification, stats or standings effect |
| Concurrent finalize | one processing version wins; stale caller gets original result or 409; database remains complete |
| Edit official match | 409 even if client sends draft-looking payload |
| Reopen without reason | rejected |
| Reopen with yellow threshold effect | cards/consumption/suspension/ledger/eligibility/notifications/stats/standings deterministically reverse or rebuild |
| Re-finalize after correction | exactly one correct final state; cancelled old source effects are not counted |
| Ledger crash/retry | ledger row and decrement commit atomically; retry cannot double-decrement or strand an undecremented unique row |

### 8.3 Discipline rules and anomalies

- First/second/threshold yellow across applicable official matches, with consumed cards never reused.
- Yellow plus second-yellow dismissal in one match does not double-count accumulation.
- Direct red creates indefinite provisional ineligibility without assuming one final match; confirmed/reduced/extended/cancelled/already-served decisions compute remaining correctly.
- RuleSet selection is deterministic by organization, season, competition, version/effective date; cross-organization and wrong historical versions are rejected.
- Official, postponed, cancelled, abandoned, replay, no-kickoff, interrupted, forfeit by each club, wrong competition/category, and cross-season serving decisions each produce the correct ledger reason.
- Suspended scorer/card recipient and wrong-club event produce one persisted anomaly; explicit confirmation is reasoned/audited and does not auto-apply forfeits/fines.
- `MatchDisciplineImpact` agrees with source cards, suspensions, ledger, notification recipients, and next applicable match after retries/rebuilds.

### 8.4 Authorization and data leakage

| Actor/case | Expected |
|---|---|
| Anonymous | 401 on every workspace endpoint |
| `CLUB_ADMIN` calls `/api/admin/matches/*` | 403, including event/finalize/reopen/report routes |
| Admin from organization B | 404/403 without match existence leakage; no mutation or audit access |
| Participating club | allowlisted official/public DTO plus own eligibility/notifications only |
| Non-participating club | 404/403 |
| Club payload inspection | no internal notes, referee report, override rationale, audit, draft/cancelled events, unpublished officials, or opponent eligibility |
| Malicious IDs/body | invalid ObjectIds, extra fields, unsafe report/action paths, oversized text rejected before database mutation |

### 8.5 UI, accessibility, and end-to-end

- Keyboard-only traversal of the seven tabs, forms, event drawer, confirmation dialogs and return focus; correct ARIA tab semantics and live announcements.
- Visual/functional checks at 375/768/1024/1440 px: no horizontal page scroll, readable score header, 44 px targets, 4.5:1 contrast, no hover-only action.
- Per-tab skeleton, empty, error, denied, validation, draft/read-only, official, stale-version, transaction-failure and retry states.
- E2E-3: create draft → enter goals/cards → mismatch blocked → correct → finalize → discipline/club notification/public detail visible → reasoned reopen → correct event → re-finalize → one rebuilt effect set.
- E2E-4: direct red → provisional club visibility → decision → next eligible match serving → report/history; replay twice to prove idempotency.
- Phase 9 contract test: draft officials invisible, published officials visible. Phase 10 contract test: each participating club receives exactly one recipient delivery per event version.
