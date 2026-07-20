# Product Specification — FTF Competition & Disciplinary Management Platform

> **This document is the authoritative product spec**, transcribed from the owner's brief so no requirement lives only in a conversation. Data-model details live in [database.md](database.md); API surface in [api.md](api.md); security in [security.md](security.md); UI direction in [ui-ux.md](ui-ux.md); disciplinary rule traceability in [disciplinary-rules-sources.md](disciplinary-rules-sources.md); execution order in [implementation-roadmap.md](implementation-roadmap.md).

## 1. Product vision

A centralized football competition and disciplinary management platform for a federation (initially the Fédération Tunisienne de Football; SaaS-ready for other organizations later).

The federation administration can:

- Manage seasons, competitions, clubs, players.
- Create and organize championship rounds (**Journées**) and schedule matches for each journée.
- Enter match results after matches are played; enter goals and disciplinary cards.
- Automatically track yellow-card accumulation and automatically create player suspensions.
- Manage red-card disciplinary decisions.
- Track how suspensions are served (ledger-based).
- Calculate standings.
- Detect player eligibility for future matches.
- Notify clubs about cards and suspensions.
- Maintain a complete audit history.

**Club administrators do not enter official data.** They consult: club info, players, previous/next matches, match details, results, goals, cards, standings, card accumulation, active suspensions, matches remaining per suspension, eligibility, and federation notifications.

### Roles

```ts
type UserRole = "FTF_ADMIN" | "CLUB_ADMIN";
```

The FTF administrator manually enters official information obtained after each match.

### Out of scope (current version — do NOT build)

Referee role/portal · full electronic match-sheet workflow · VAR management · live referee data entry · ticketing · payments · fan/player/coach accounts · complex transfer workflows · complex licence workflows · public website · billing plans.

Existing unused models (`Licence`, `Transfert`, `Evenement`, `Staff`) remain **frozen future modules**. `Arbitre` is an approved future administrative module for referee management and match-official assignment, but it does not introduce a user role, login, dashboard, portal, live referee entry, or electronic match-sheet workflow.

## 2. Core modules

Authentication · Users & roles · Clubs · Players · Seasons · Competitions · Journées · Matches · Match results · Match events (goals, cards) · Suspensions · Disciplinary decisions · Eligibility · Standings · Notifications · Audit log · Reports & exports · System settings · Disciplinary rule configuration.

## 3. SaaS architecture

- `Organization { name, code, type: "FEDERATION"|"LEAGUE", active }`; all important records carry `organizationId` (Users, Clubs, Seasons, Competitions, Matches, Cards, Suspensions, Notifications, Audit logs).
- Seed one organization: **Fédération Tunisienne de Football**.
- Purpose: data isolation, future multi-federation deployment, cleaner authorization, safer reporting. **No billing.**
- If immediate introduction is risky, use the documented staged migration (see [database.md](database.md) §Migration).

## 4. Permissions

### FTF_ADMIN can
Access all federation data · manage seasons/competitions/rules/clubs · create club-admin accounts · manage players & club assignment · create journées · generate or manually create fixtures · modify schedules · enter results/goals/cards · finalize matches · reopen matches with reason · finalize journées · manage red-card decisions · create/correct/cancel suspensions (mandatory reason) · view all audit history · generate reports/exports · create and send manual club notifications · view delivery/read statistics · archive or duplicate sent notifications · manage settings.

### CLUB_ADMIN can (own club only, plus shared competition data)
View club dashboard, players, player profiles, card history, suspensions, eligibility, previous/next matches, match details, goals/cards, standings, notifications · download visible disciplinary decisions · update own password/account info · mark notifications read.

### CLUB_ADMIN cannot
Create/edit matches · enter results/goals/cards · modify players/suspensions/competitions/journées/standings · view another club's confidential data · access admin pages · call admin APIs.

**Every permission is enforced server-side. Hiding a button is not authorization.**

## 5. Business workflows

### 5.1 Initial federation setup
Create current season → create competition → select participating clubs → configure scoring rules → configure disciplinary rules → create/generate journées → create fixture calendar → create club-admin accounts → add or import players.

### 5.2 Championship calendar
Support: manual fixture creation · automatic round-robin (single leg or home-and-away) · manual date adjustment · postponed-match rescheduling · conflict validation.

Detect: same club in two matches at the same time · home = away · duplicate fixture in a round · missing club in a round · non-member club · match without journée. **Never silently overwrite an existing calendar.**

### 5.3 Result entry after a journée
Admin opens a journée → sees every scheduled match. Per match: enter home/away score, set status, add goals, add cards, admin notes, optional scanned document, **save as draft**, **finalize**. A fast **bulk score-entry** mode exists.

Finalizing triggers: result validation → goal-total validation → card confirmation → eligibility anomaly checks → yellow accumulation → red provisional suspensions → suspension serving → player statistics recalculation → standings recalculation → club notifications → audit-log entries.

### 5.4 Match finalization (`MatchFinalizationService`)
Must be: **atomic · idempotent · transactional (MongoDB transaction; Docker Mongo must run as replica set) · protected against duplicate & concurrent calls · audited · recoverable.** Route handlers stay thin; the service owns the logic.

### 5.5 Reopening a match
FTF_ADMIN only. Requires mandatory reason + confirmation dialog + audit entry + transaction. On reopen: do NOT delete suspensions — reverse or **rebuild derived effects deterministically from authoritative match events** (accumulations, suspensions, serving entries, standings, statistics, notifications). Preserve history.

Sprint 11.1 now fails closed: a discipline-free official match can be reopened transactionally and queues durable standings/round repair, while any match with cards, source suspensions, or serving-ledger effects returns a conflict until canonical event replay exists. Deterministic discipline/statistics/notification replay remains a Sprint 11.2 prerequisite for those corrections.

### 5.6 Yellow-card workflow
```
admin adds yellow → match draft → finalize → official yellows counted
→ threshold reached → automatic 1-match suspension created
→ source cards marked consumed → club notified
→ player unavailable for next applicable official match
```
At two active warnings the UI shows: **"À risque — à un carton jaune de la suspension"**.

### 5.7 Red-card workflow
```
admin records red → finalize → provisional suspension immediately
→ player unavailable → case in "Décisions rouges en attente"
→ admin records disciplinary decision → final duration computed
→ already-missed eligible matches deducted → club receives decision
```
Decision form fields: player, club, source match, red type, minute, initial notes, total matches, scope, decision date/reference/reason, supporting PDF, already-served matches, remaining matches.

### 5.8 Suspension serving
After each eligible official match is finalized: find active suspensions of both clubs → evaluate each independently → decide countability → write **one ledger entry** → decrement only if permitted → **never decrement twice** (unique constraint) → mark SERVED at zero → notify club → refresh eligibility.

### 5.9 Journée completion
Complete when every scheduled match is OFFICIAL, **or** every non-official match carries an explicit state (postponed/cancelled/abandoned/replay ordered). Postponed matches stay visible; a "complete" journée does not imply postponed matches were played.

### 5.10 Standings
Match results are the source of truth. Compute: played, W/D/L, GF, GA, GD, points, rank. Support configurable points, forfeit results, point deductions, annulled results, reopened matches, **stable tie-breaker ordering**. Standings snapshot must be rebuildable: `StandingsService.rebuildCompetitionStandings()`. Embedded arrays must never be the only source of truth.

## 6. Disciplinary baseline (see disciplinary-rules-sources.md for article-level traceability)

### 6.1 Yellow accumulation
3 warnings in 3 **official** matches ⇒ automatic suspension for the next official match. Friendlies never count. Third warning auto-creates the suspension (no manual confirmation if the official rule is automatic). Admin may correct/cancel only with mandatory reason + audit. Trigger cards → `CONSUMED_BY_SUSPENSION`, never reused. Third yellow in the final competition match ⇒ suspension applies to the first applicable official match after. Season end: remaining 1st/2nd warnings cleared as an **auditable operation** (`CLEARED_AT_SEASON_END`), never deleted.

```ts
type CardAccumulationStatus = "ACTIVE" | "CONSUMED_BY_SUSPENSION" | "CANCELLED" | "CLEARED_AT_SEASON_END";
```

### 6.2 Red cards
Provisional suspension immediately; player stays suspended until the competent decision is recorded. Decision may be N matches, until-date, cancelled, reduced, or already served via matches missed pre-decision (deducted). **Never assume 1 match.**

### 6.3 Same-match yellow then exclusion
```ts
type CardType = "YELLOW" | "SECOND_YELLOW_RED" | "DIRECT_RED";
```
A second-yellow dismissal is one event — never two independent yellows feeding accumulation. When the cumulative rule says the graver offence replaces the warning, the yellow must not continue in accumulation.

### 6.4 Cross-season carryover
Preserve original season, original match, remaining matches, serving season, qualification date where applicable, category/competition scope.

### 6.5 Serving engine evaluation
Per (suspension, match): official? started? completed? interrupted? abandoned? cancelled? postponed? replayed? forfeit (and which club caused it)? correct category? applies to this competition / all competitions? player already suspended at match date? match already used for this suspension?

Ledger entry (`SuspensionServiceEntry`) with `counted`, `reason` enum (`OFFICIAL_MATCH_PLAYED`, `INTERRUPTED_MATCH_COUNTS`, `FORFEIT_COUNTS`, `NO_KICKOFF_DOES_NOT_COUNT`, `CLUB_ABSENT_DOES_NOT_COUNT`, `WRONG_COMPETITION`, `WRONG_CATEGORY`, `ALREADY_COUNTED`, `MANUAL_CORRECTION`), `remainingBefore/After`, `processedAt/By`. **Unique DB constraint on (suspensionId, matchId).**

### 6.6 Suspended player participating anyway
Raise anomaly `SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT`; admin may record a decision (extra match, disputed match not counted, club penalty, notes, fine info, document). **Nothing financial/match-loss is applied automatically.**

### 6.7 Friendlies
`isOfficial: boolean` on competition/match. Friendlies don't count for accumulation or ordinary serving; serious conduct can still open a case.

### 6.8 Club responsibility
Clubs are officially responsible for monitoring counts ⇒ club portal must clearly show: active suspensions, remaining matches, source decision, source cards, served matches, next applicable match, any pending decision.

## 7. Required pages

### 7.1 FTF admin (`/admin`)

| Page | Essentials |
|---|---|
| `/admin/dashboard` | Season+competition selectors; counts (clubs, players); current journée; matches awaiting result/finalization; active suspensions; pending red decisions; 2-yellow players; recent finalizations & disciplinary actions; upcoming matches; compact `Notifications aux clubs` card (unread deliveries, recently sent count, last manual notification, create/history links); quick actions; limited charts |
| `/admin/seasons` + `[id]` | CRUD, activate current, complete, **end-of-season card clearance**, archive; detail tabs: overview, competitions, discipline summary, clearance history, audit |
| `/admin/competitions` + `[id]` | List/search/filter/CRUD/archive; workspace tabs: overview, journées, matches, standings, clubs, discipline, statistics, rules, audit |
| `/admin/competitions/[id]/rounds` | Journée list: number, dates, status, completed/pending, goals, cards, quick "enter results" |
| `/admin/competitions/[id]/rounds/[roundId]` | **Flagship page.** Match grid (date, time, clubs, score, status, goal completeness, card count, finalization state); bulk score entry; save all drafts; finalize selected; finalize journée; filters pending/official/postponed |
| `/admin/matches` + `/new` + `[id]` | Filters (season, competition, journée, club, status, date range, entry state). Detail tabs: Overview (result, metadata, notes, document, finalization history) · Goals (scorer, club, minute, stoppage, type, assist; editable while draft) · Cards (player, club, minute, type, reason, accumulation before/after, generated suspension) · Discipline impact (suspensions generated/served, anomalies, pending reds) · Audit. Actions: edit draft, finalize, reopen, reschedule, postpone, abandon, forfeit, order replay — strong confirmations |
| `/admin/clubs` + `[id]` | List (logo, name, code, status, player count, active suspensions, next match, admin-account status); add/edit/archive; create/reset club-admin access. Detail tabs: overview, players, matches, cards, suspensions, users, audit |
| `/admin/players` + `[id]` | Filters (club, position, status, yellow-risk, suspended, name/licence search); columns incl. active yellows, suspension status, eligibility, next applicable match. Detail: disciplinary timeline; tabs overview, stats, goals, cards, suspensions, serving ledger, audit |
| `/admin/discipline` | KPIs (active/provisional suspensions, pending reds, 2-warning players, auto yellow suspensions, served); sections overview / yellow accumulation / red decisions / active / served / anomalies / manual decisions |
| `/admin/discipline/yellow-cards` | Player, club, active count, source matches, latest card date, risk, generated suspension |
| `/admin/discipline/red-cards` | Player, club, match, date, type, provisional suspension, eligible matches already missed, decision status, decide action |
| `/admin/discipline/suspensions` + `[id]` | Filters (status, club, competition, reason, remaining). Detail: all fields + serving ledger + notifications + audit; actions confirm/amend/cancel/overturn/document/manual correction — **every change requires a reason** |
| `/admin/discipline/anomalies` | Suspended player in event; wrong-club card; duplicate card/suspension; double decrement; official match w/o processing; score≠goals; inconsistent accumulation |
| `/admin/standings` | Season/competition selection, table, **rebuild button**, calculation timestamp, export |
| `/admin/users` | List, create club admin, activate/suspend, reset password, require password change, login history |
| `/admin/notifications` | Overview/history and `Créer une notification`; KPI cards; manual/automatic source, recipient, club, status, date and text filters; delivery/read statistics; view, duplicate and archive actions. Sent content is immutable—corrections are new notifications |
| `/admin/reports` | See §10 |
| `/admin/audit` | Read-only; filters user/club/action/entity/date/competition/match |
| `/admin/settings` | Organization, current season, competition defaults, disciplinary rules, notification templates, security, upload limits, language & timezone |

### 7.2 Club admin (`/club`) — fully scoped to session `clubId`

| Page | Essentials |
|---|---|
| `/club/dashboard` | Club identity; **next-match card**; previous result; standing; played/GF/GA; active suspensions; 2-yellow players; recent cards; `Notifications de la FTF` with the latest 3–5 relevant items and important/urgent unread emphasis; upcoming fixtures |
| `/club/players` + `[id]` | Own players only; columns shirt, position, active yellows, eligibility, suspension, remaining. Detail (own player only): info, stats, goals, cards, accumulation, suspension history, eligibility. **No edit buttons for sporting data** |
| `/club/matches` + `[id]` | Tabs upcoming/previous/all/postponed. Detail access if club participates or data is shared competition info; goal/card timelines; own-club suspensions & availability; **never opposing club's confidential notes** |
| `/club/calendar` | Calendar + list: previous, next, postponed, rescheduled |
| `/club/cards` | Own players' cards; filters player/type/competition/journée/date; shows accumulation status + generated suspension |
| `/club/suspensions` | Sections active/provisional/served/history; per item: player, reason, source match, decision date, total/served/remaining, scope, next applicable match, decision document if visible |
| `/club/eligibility` | Available / at-risk / suspended / pending-red players; reason; expected return match; **select an upcoming match to view eligibility for that match** |
| `/club/standings` | Full table, own club highlighted, last update, recent form if derivable |
| `/club/notifications` | Own-club automatic and manual federation notifications; all/unread/important/urgent/category filters; safe internal actions; mark one or all read. No edit/delete, recipient-list, or audit access |
| `/club/profile` | View club info; update own account; change password. No club sporting-data edits |

### 7.3 Navigation

- **Admin sidebar:** Dashboard, Seasons, Competitions, Journées, Matches, Clubs, Players, Discipline, Standings, Reports, Notifications, Users, Audit, Settings.
- **Club sidebar:** Dashboard, Players, Matches, Calendar, Cards, Suspensions, Eligibility, Standings, Notifications, Profile.
- Consistent icons; nested navigation instead of a crowded flat list.

## 8. Notifications (in-app first; email only if SMTP configured)

### 8.1 Sources and automatic triggers

The single notification center distinguishes `SYSTEM` (`Notification automatique`) from `MANUAL` (`Notification manuelle`). Automatic triggers include new card · two active warnings reached · yellow threshold reached · red provisional suspension · red decision finalized · suspension amended/cancelled/served · referee assignment published/updated/cancelled · match postponed/rescheduled · result published. **No duplicates on service or finalization retry.**

### 8.2 Manual club notifications

Only `FTF_ADMIN` may compose and send a manual plain-text notification to all active clubs, one active club, or multiple active clubs. `CLUB_ADMIN` may only receive notifications addressed to its session-derived club and mark that club's delivery read.

Required content: title (trimmed, 3–150 characters) and message (trimmed, 3–5000 characters, line breaks preserved). Optional content: action label, allowlisted internal `/club/...` path, and future expiration date. Administrator text is never rendered as raw HTML.

Categories: `GENERAL_ANNOUNCEMENT`, `COMPETITION`, `MATCH`, `DISCIPLINE`, `ADMINISTRATIVE`, `DOCUMENT_REQUEST`, `MEETING`, `SYSTEM`. Priorities: `NORMAL`, `IMPORTANT`, `URGENT`; urgent styling is reserved for genuinely time-critical notices.

Target types are `ALL_ACTIVE_CLUBS`, `SINGLE_CLUB`, and `MULTIPLE_CLUBS`. For all-club sends, the server resolves active clubs in the authenticated administrator's organization and ignores client club IDs. Single/multiple sends validate active organization membership and reject or normalize duplicate IDs.

### 8.3 Send, history, expiration, and audit

```text
compose → choose recipients → validate → preview → confirm
→ transaction creates notification + one recipient record per club
→ club notification centers display it → audit entry is written
```

The preview and confirmation show title, priority and authoritative recipient count. Delivered notification content is immutable. A correction is a new notification; duplication creates a prefilled new draft and does not silently resend. Archiving changes the admin history state without deleting delivery/read history or retracting it from clubs. Expired notifications remain in history but are no longer highlighted as active.

Audit actions: `MANUAL_NOTIFICATION_CREATED`, `MANUAL_NOTIFICATION_SENT`, `MANUAL_NOTIFICATION_BROADCAST_SENT`, `NOTIFICATION_DUPLICATED`, and `NOTIFICATION_ARCHIVED`. Audit metadata includes actor, notification ID, target type, recipient count, selected club IDs where relevant, title, priority, sent date, and request ID—but not the full message body.

### 8.4 Delivery guarantees

Read/unread state is per club, not global. A unique `(notificationId, clubId)` recipient index prevents duplicate delivery inside a broadcast. Automatic sends use a unique organization-scoped `dedupeKey`; manual POST retries use an organization-scoped idempotency key. Parent and recipient creation is transactional so partial delivery is rolled back and reported rather than silently accepted.

## 9. Search, filtering, imports

- Global admin search: player name, licence number, club, match, competition, suspension reference. Debounced; server-side pagination/filtering; never load all records client-side.
- CSV imports (clubs, players, fixtures, results): upload → validate → error preview → confirm → process → result report. Downloadable templates. No unvalidated inserts.

## 10. Reports & exports

- **Admin:** fixtures/results by journée, standings, goalscorers, cards by club/player, 2-warning players, active/provisional/served suspensions, red decisions, serving history, anomalies, club disciplinary summary.
- **Club:** fixtures, results, player card history, active suspensions, eligibility list.
- CSV/Excel: clean columns, correct dates. PDF: federation header, title, season, competition, generation date, page numbers, clear tables.

## 11. Edge-case catalog (acceptance criteria — each becomes a named test)

1. First yellow → recorded, ACTIVE.
2. Second yellow (other official match) → "at risk".
3. Third yellow → automatic suspension; cards consumed.
4. Third yellow in last competition match → carries to next applicable official match.
5. Season-end clearance of remaining warnings (auditable).
6. Consumed cards never reused.
7. Yellow + second-yellow-red same match → correct single accumulation handling.
8. Yellow + direct red same match → graver offence handling.
9. Direct red, decision pending → provisional suspension.
10. Final red decision shorter than matches already missed → served/closed correctly.
11. Final red decision longer → remaining computed correctly.
12. Suspension continues into next season.
13–19. Official match postponed / cancelled / never started / interrupted / abandoned / forfeit (incl. caused by suspended player's club) / replay ordered — correct ledger behavior in each.
20. Suspended player recorded as scorer → anomaly.
21. Suspended player recorded as carded → anomaly.
22. Duplicate card entry → rejected/flagged.
23. Match finalized twice → single effect (idempotent).
24. Suspension decremented twice → impossible (unique ledger).
25. Match reopened after generating suspension → deterministic rebuild.
26. Goal removed after finalization → requires reopen/correction workflow.
27. Yellow corrected to red → accumulation and suspension recomputed.
28. Red card cancelled → provisional suspension resolved correctly.
29. Player changes club with active suspension → suspension follows player.
30. Club admin accesses another club's player → denied.
31. Club admin calls admin API → denied.
32. Score ≠ recorded goals → finalization blocked/flagged.
33. Player not in either participating club → event rejected.
34. Same club twice in one journée → generation/validation error.
35. Journée with postponed match + others complete → completion semantics correct.
36. Rules change between seasons → historical records keep original rule version.

## 12. Performance

DB indexes · pagination everywhere · lean read queries · field selection · no N+1 · cache only public/safely-scoped data · **never cache club-specific data across users** · efficient standings rebuild · background jobs for large exports if needed.

## 13. Seed data (development)

1 FTF admin · 8+ clubs with club admins · 18+ players per club · one active season · one league competition with journées · matches in mixed states · cards and suspensions that exercise the discipline engine. **Seed never runs in production.**

## 14. Referee administration and club visibility (approved future scope)

### 14.1 Scope and roles

The role type remains exactly `"FTF_ADMIN" | "CLUB_ADMIN"`. Referees are administrative entities, not users. There is no referee account, authentication flow, dashboard, portal, live data-entry surface, or digital match sheet.

- `FTF_ADMIN` manages referee records, availability/status, assignments, publication, changes, cancellation, conflicts, and internal assignment history.
- `CLUB_ADMIN` can only view a published assignment for a match involving its session-derived club and receive the related in-app notifications.
- Draft assignments, private notes, audit history, change reasons, contact details, and internal comments are never returned by club APIs.

### 14.2 Referee registry

Adapt the existing French `Arbitre` model. The registry supports create, edit, activate/deactivate, archive, search, category/status/city or region filters, assigned-match count, and upcoming/previous assignment views. Canonical statuses are `ACTIVE`, `UNAVAILABLE`, `SUSPENDED`, `INACTIVE`, and `ARCHIVED`; canonical categories are `ELITE`, `NATIONAL`, and `REGIONAL`.

Photos are optional legacy data. The main create/edit flow has no photo upload. Lists use one local Lucide `UserRound` icon in a rounded deep-navy or neutral avatar container, including when a legacy photo path is absent or invalid; no external image URL or broken placeholder is permitted.

### 14.3 Assignment and publication workflow

On `/admin/competitions/[competitionId]/rounds/[roundId]`, each match supports a main referee and optional first assistant, second assistant, and fourth official:

```text
open journée/match → save draft → validate conflicts → publish
→ notify both participating clubs → expose the published public DTO
```

The main referee is required to publish. `DRAFT` is never visible to clubs. A published assignment change requires a reason, creates a new version and audit entry, notifies both clubs, and is shown as updated. Cancellation is audited and notified. Repeating publish for the same version is idempotent.

Publication must reject a missing or non-active main referee, unavailable/suspended/inactive/archived officials, duplicate roles within one match, invalid match/journée/date, and an official assigned to conflicting match times. Near-time conflicts use an explicit configurable turnaround window and are never silently accepted.

### 14.4 Club experience

- `/club/dashboard`: the first upcoming match is a prominent clickable card with competition, journée, home/away context, opponent and logo, date/time, stadium, match status, unavailable-player count, detail link, and published officials. Otherwise show `Arbitre non encore désigné`.
- `/club/matches`: upcoming and previous cards/rows include the published main referee and a detail link; previous matches retain score, goals, cards, and referee.
- `/club/matches/[id]`: show complete public match metadata, score/events after play, own-club eligibility and suspensions, plus only the published main/assistant/fourth officials, main-referee category, and publication date.

### 14.5 Notifications and audit

Notification types are `REFEREE_ASSIGNMENT_PUBLISHED`, `REFEREE_ASSIGNMENT_UPDATED`, and `REFEREE_ASSIGNMENT_CANCELLED`. Each notification includes competition, journée, clubs, match date/time, stadium, public official names, and a deep link. Dedupe key format is `<TYPE>:<matchId>:<assignmentVersion>:<recipientClubId>` so both clubs receive one notification each without collisions.

Audit actions cover referee create/update/archive and assignment create/publish/change/cancel, with actor, match, before/after assignment, mandatory reason where applicable, timestamp, and request ID.

### 14.6 Acceptance criteria

1. A draft assignment is absent from every club payload and page.
2. A club cannot read a match or assignment for another club.
3. A club payload contains no internal notes, audit data, contact details, referee report, or change reason.
4. One referee cannot occupy two roles in a match or conflicting matches.
5. Publishing without an active main referee fails.
6. Re-publishing one version does not duplicate notifications.
7. Updating a published assignment without a reason fails; a successful update creates a versioned audit record and two club notifications.
8. Archived referees remain resolvable in historical assignments but cannot receive new assignments.

## 15. Official match workspace (future scope — approval gated)

### 15.1 Workspace and state transitions

The canonical admin detail is `/admin/matches/[id]`; `/admin/matchs/[id]` remains a temporary compatibility alias. It is one match workspace with keyboard-accessible tabs: `Vue d’ensemble`, `Résultat`, `Buts`, `Cartons`, `Discipline`, `Arbitres`, and `Historique`. The persistent header shows competition, journée, clubs/logos, score, canonical status, date/time, stadium/city, main referee when publishable, and the single contextual primary action.

Draft matches may be edited. Official matches are read-only until an `FTF_ADMIN` explicitly reopens them with a reason and confirmation. Finalize and reopen are server-authoritative state transitions; hiding UI controls is not authorization. `CLUB_ADMIN` never receives an editing action.

### 15.2 Structured result, goal, and card entry

- Result fields: home score, away score, status, date/time, stadium, city, main referee, optional assistants, and internal notes. Scores are never rewritten during GET.
- Goal types: `GOAL`, `OWN_GOAL`, and `PENALTY_GOAL`; fields include player, player club, minute, stoppage minute, optional assist, notes, and immutable source identity. An own goal credits the opponent's score while retaining the player's club.
- Card types: `YELLOW`, `SECOND_YELLOW_RED`, and `DIRECT_RED`; fields include player, club, minute, stoppage minute, reason, report reference, and notes.
- Events are draft records that can be edited or cancelled before finalization. Cancellation preserves history. Player/assist membership, club participation, minute bounds, duplicate/idempotency keys, and same-player/same-match disciplinary combinations are validated server-side.

Score and active goal totals must agree before finalization. A limited administrative/forfeit score may continue only through an explicit override containing an allowed reason code, explanation, actor, timestamp, and audit entry. A non-zero score with zero recorded goals is also a mismatch; it is never silently accepted.

### 15.3 Discipline impact and anomaly handling

The `Discipline` tab is a derived projection, not another editable source of truth. It shows confirmed cards, yellow accumulation before/after, generated/provisional/final suspensions, serving-ledger changes, the next affected official match, delivered club notices, and anomalies. A suspended scorer/card recipient or wrong-club player creates a reviewable anomaly; finalization requires an explicit, audited confirmation where policy permits it and never applies a sporting or financial sanction automatically.

Rule evaluation uses the versioned `DisciplinaryRuleSet` applicable to the organization, season, competition, and match date. Second-yellow dismissal does not double-count the absorbed yellow. Direct red creates a provisional suspension with no assumed one-match final punishment; a later reasoned decision confirms, reduces, extends, cancels, or marks it already served.

Automatic notification events are `YELLOW_THRESHOLD_REACHED`, `RED_CARD_PROVISIONAL_SUSPENSION`, and `SUSPENSION_CONFIRMED`. They include the player/club, source match, competition/journée/date, rule-derived total/served/remaining values, suspension link, and the next applicable match (opponent, date/time, stadium) when determinable; otherwise they state that the affected match awaits calendar publication. Correction/replay creates a new versioned correction notice or reconciles an unsent intent—never mutates a delivered notice or duplicates it.

### 15.4 Transactional completion and correction

Finalization atomically validates the aggregate, claims one processing version, marks the result official, materializes cards/suspensions/serving entries, records durable notification intent, and writes audit history. Any required discipline write failure rolls back the match finalization. Retries and concurrent calls cannot duplicate cards, suspensions, ledger entries, notifications, statistics, or standings effects.

Reopening preserves authoritative event history and reverses or deterministically rebuilds every derived effect before returning the match to draft: cards and accumulations, red cases and suspensions, serving entries, eligibility, player statistics, standings, notification corrections, and audit history. A durable replay/reconciliation mechanism owns post-transaction projections; best-effort callbacks are insufficient for required effects.

### 15.5 Club visibility and dependencies

Club match APIs return allowlisted DTOs only. A participating `CLUB_ADMIN` sees public match metadata, official score/events, its own players' availability/suspensions, and its own relevant disciplinary notifications—never opponent eligibility, internal notes, referee report, audit metadata, override explanation, or draft events.

The club dashboard's next-match card shows opponent and home/away context, competition/journée, date/time/stadium, published referee, suspended count, at-risk count, and a detail link. `Joueurs indisponibles pour ce match` lists only the authenticated club's player, reason, remaining matches, and expected return. Before play, club match detail shows own unavailable/at-risk players; after play it adds the official goal/card timeline and only discipline impact involving that club.

The `Arbitres` tab consumes the versioned assignment contract from Phase 9; until that phase is implemented it may show only a read-only legacy summary. Automatic match/discipline notifications consume the parent/recipient and idempotency contract from Phase 10; this workspace must not create a second notification architecture. No referee or player role is introduced.

### 15.6 Acceptance criteria

1. Adding a goal never silently marks a match finished or official.
2. Two sequential or concurrent finalization calls produce one complete set of effects.
3. Injected discipline failure rolls back finalization; no official match is left partly processed.
4. Goal totals, including own goals, match the score or require a documented audited override.
5. A finalized match cannot be edited; reopen without a reason fails.
6. Reopen/re-finalize reconstructs exactly one correct set of derived effects.
7. Serving ledger `(suspensionId, matchId)` creation and decrement are atomic and idempotent.
8. A club response contains only its authorized public and own-club fields.
9. Every tab has loading, empty, error, denied, draft, and official states where applicable and works at 375 px without horizontal page scrolling.
