# Database — Target Data Model & Migration Strategy

> MongoDB + Mongoose. Existing models are **adapted in place** where sound; new domain models are created in English. Nothing is deleted; superseded models are frozen with `@deprecated` headers. See [architecture-audit.md](architecture-audit.md) for the current-state assessment.

## 1. Model mapping (existing → target)

| Existing (`lib/models/`) | Target | Strategy |
|---|---|---|
| `User.ts` | `User` (extended) | Adapt in place: add name/status/lockout fields; migrate role values |
| `Club.ts` | `Club` (extended) | Adapt: add code/slug/shortName/status + unique indexes |
| `Joueur.ts` | `Joueur` (extended) | **Keep French name** (decision D1). Add status/displayName/category; derived stats get rebuild function |
| `Saison.ts` | `Saison` (extended) | Adapt: code/status/isCurrent; `configuration` seeds the first DisciplinaryRuleSet |
| `Competition.ts` | `Competition` (extended) | Adapt: tieBreakers/isOfficial/ruleSet link/status; deprecate embedded `classement` (stop writing, keep field) |
| `Match.ts` | `Match` (extended) | Adapt additively: roundId, isOfficial, new statuses, finalization metadata, processingVersion, forfeit fields; keep `journee`/`homologue` during transition |
| — | `Organization` | **New** |
| — | `Round` (Journée) | **New** — migrated from `Match.journee` numbers |
| — | `MatchEvent` | **New** — normalized events replace embedded `Match.evenements` (embedded array kept read-only during transition) |
| — | `DisciplinaryCard` | **New** |
| — | `DisciplinaryRuleSet` | **New**, versioned |
| — | `Suspension` | **New** — supersedes `Discipline` for player suspensions |
| — | `SuspensionServiceEntry` | **New** — the serving ledger |
| — | `Notification` | **New** |
| — | `AuditLog` | **New**, immutable |
| — | `Standings` | **New** — snapshot collection, rebuildable |
| `Discipline.ts` | frozen | Kept for history reference; new engine writes to Suspension/DisciplinaryCard |
| `Arbitre.ts` | kept (fix TS bug) | Basic CRUD stays; no referee portal |
| `Staff.ts`, `Evenement.ts`, `Licence.ts`, `Transfert.ts` | frozen future modules | `@deprecated`/`future-module` header comments only |

## 2. Target interfaces

### Organization
```ts
interface Organization {
  name: string;
  code: string;                 // unique
  type: "FEDERATION" | "LEAGUE";
  active: boolean;
}
```

### User
```ts
interface User {
  organizationId: ObjectId;
  name: string;
  email: string;                // normalized lowercase; unique per organization
  passwordHash: string;         // select: false — never exposed
  role: "FTF_ADMIN" | "CLUB_ADMIN";
  clubId?: ObjectId;            // REQUIRED when role === CLUB_ADMIN
  status: "ACTIVE" | "SUSPENDED" | "INVITED" | "DISABLED";
  mustChangePassword: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdBy?: ObjectId;
  createdAt: Date; updatedAt: Date;
}
```

### Club
```ts
interface Club {
  organizationId: ObjectId;
  name: string; shortName: string; code: string; slug: string;
  logoUrl?: string; city?: string; stadium?: string; colors?: string[];
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  createdAt: Date; updatedAt: Date;
}
// unique: (organizationId, code), (organizationId, slug)
// soft archival instead of delete when historical matches exist
```

### Player (implemented on existing `Joueur` schema)
```ts
interface Player {
  organizationId: ObjectId; clubId: ObjectId;
  firstName: string; lastName: string; displayName: string;
  licenceNumber: string;        // unique per organization
  shirtNumber?: number; dateOfBirth?: Date; nationality?: string;
  position: "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";
  category?: string;
  status: "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "RETIRED" | "ARCHIVED";
  createdAt: Date; updatedAt: Date;
}
// Derived stats (goals/cards/matches) NEVER the only source of truth:
// computed from MatchEvent/DisciplinaryCard, or safe counters + rebuild function.
```

### Season (on existing `Saison`)
```ts
interface Season {
  organizationId: ObjectId;
  name: string; code: string;
  startDate: Date; endDate: Date;
  status: "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  isCurrent: boolean;           // exactly one current per organization
  createdAt: Date; updatedAt: Date;
}
```

### Competition
```ts
interface Competition {
  organizationId: ObjectId; seasonId: ObjectId;
  name: string; shortName: string; code: string;
  format: "LEAGUE" | "CUP" | "GROUP_STAGE";   // v1 prioritizes LEAGUE; no cup brackets
  category: string; isOfficial: boolean;
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  pointsForWin: number; pointsForDraw: number; pointsForLoss: number;
  tieBreakers: Array<"POINTS"|"HEAD_TO_HEAD"|"GOAL_DIFFERENCE"|"GOALS_SCORED"|"FAIR_PLAY">;
  clubIds: ObjectId[];
  disciplinaryRuleSetId: ObjectId;
  createdAt: Date; updatedAt: Date;
}
```

### Round (Journée)
```ts
interface Round {
  organizationId: ObjectId; seasonId: ObjectId; competitionId: ObjectId;
  number: number; name: string;
  leg?: "ALLER" | "RETOUR" | "SINGLE";
  startDate?: Date; endDate?: Date;
  status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "LOCKED";
  createdAt: Date; updatedAt: Date;
}
// unique: (organizationId, competitionId, number)
```

### Match (extended)
```ts
interface Match {
  organizationId: ObjectId; seasonId: ObjectId; competitionId: ObjectId; roundId: ObjectId;
  homeClubId: ObjectId; awayClubId: ObjectId;   // must differ; both must belong to competition
  scheduledAt: Date; venue?: string;
  status: "DRAFT" | "SCHEDULED" | "POSTPONED" | "IN_PROGRESS"
        | "PLAYED_PENDING_VALIDATION" | "OFFICIAL" | "ABANDONED"
        | "CANCELLED" | "FORFEIT" | "REPLAY_ORDERED";
  homeScore?: number; awayScore?: number;       // required to finalize a played match
  forfeitWinnerClubId?: ObjectId; forfeitCauseClubId?: ObjectId;
  isOfficial: boolean;
  finalizedAt?: Date; finalizedBy?: ObjectId;
  reopenedAt?: Date; reopenedBy?: ObjectId; reopenReason?: string;
  processingVersion: number;                    // idempotency / optimistic concurrency
  createdAt: Date; updatedAt: Date;
}
// Legacy French statuses map: Programmé→SCHEDULED, En Cours→IN_PROGRESS,
// Terminé+homologue→OFFICIAL, Terminé→PLAYED_PENDING_VALIDATION,
// Reporté→POSTPONED, Annulé→CANCELLED, À Valider→PLAYED_PENDING_VALIDATION.
```

### MatchEvent
```ts
interface MatchEvent {
  organizationId: ObjectId; matchId: ObjectId; competitionId: ObjectId; seasonId: ObjectId;
  clubId: ObjectId; playerId?: ObjectId;
  type: "GOAL" | "OWN_GOAL" | "PENALTY_GOAL" | "PENALTY_MISSED"
      | "YELLOW_CARD" | "SECOND_YELLOW_RED" | "DIRECT_RED";
  minute?: number; stoppageMinute?: number;
  assistPlayerId?: ObjectId; cardReason?: string; notes?: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  createdBy: ObjectId; createdAt: Date; updatedAt: Date;
}
// Rules: player must belong to clubId at match date; club must participate;
// own goals credit the opponent's score; event totals validated vs final score;
// post-finalization changes require reopen/correction workflow.
```

### DisciplinaryCard
```ts
interface DisciplinaryCard {
  organizationId: ObjectId;
  matchId: ObjectId; seasonId: ObjectId; competitionId: ObjectId; roundId: ObjectId;
  playerId: ObjectId; clubId: ObjectId;
  type: "YELLOW" | "SECOND_YELLOW_RED" | "DIRECT_RED";
  minute?: number; reason?: string;
  accumulationStatus: "ACTIVE" | "CONSUMED_BY_SUSPENSION" | "CANCELLED" | "CLEARED_AT_SEASON_END";
  generatedSuspensionId?: ObjectId;
  sourceEventId: ObjectId;      // stable link to MatchEvent — duplicate prevention
  createdBy: ObjectId; createdAt: Date; updatedAt: Date;
}
// unique: (sourceEventId) — one card per confirmed event
```

### DisciplinaryRuleSet (versioned — never hard-code rules in services)
```ts
interface DisciplinaryRuleSet {
  organizationId: ObjectId; seasonId: ObjectId;
  competitionId?: ObjectId; category?: string;
  name: string; version: number;
  yellowCardThreshold: number;               // baseline 3
  yellowCardSuspensionMatches: number;       // baseline 1
  yellowCardsCountOnlyOfficialMatches: boolean;
  clearUnusedYellowCardsAtSeasonEnd: boolean;
  redCardCreatesProvisionalSuspension: boolean;
  suspensionScope: "SAME_COMPETITION" | "SAME_CATEGORY" | "ALL_OFFICIAL_COMPETITIONS";
  friendlyMatchesCount: boolean;
  effectiveFrom: Date; effectiveTo?: Date;
  sourceDocument?: string; sourceArticleReferences?: string[];
  active: boolean;
  createdAt: Date; updatedAt: Date;
}
// Rule changes create a NEW version; historical seasons keep their original version.
```

### Suspension
```ts
interface Suspension {
  organizationId: ObjectId;
  playerId: ObjectId; clubId: ObjectId;
  sourceSeasonId: ObjectId; sourceCompetitionId?: ObjectId; sourceMatchId?: ObjectId;
  sourceCardIds: ObjectId[];
  reason: "THREE_YELLOW_CARDS" | "SECOND_YELLOW_RED" | "DIRECT_RED"
        | "MANUAL_DISCIPLINARY_DECISION" | "SUSPENDED_PLAYER_PARTICIPATION";
  status: "PENDING_DECISION" | "PROVISIONAL" | "ACTIVE" | "SERVED"
        | "CANCELLED" | "OVERTURNED" | "EXPIRED";
  scope: "SAME_COMPETITION" | "SAME_CATEGORY" | "ALL_OFFICIAL_COMPETITIONS";
  totalMatches?: number; servedMatches: number; remainingMatches?: number; // all three preserved
  startsAt: Date; endsAt?: Date;
  automatic: boolean;
  decisionReference?: string; decisionDate?: Date; decisionReason?: string; decisionDocumentUrl?: string;
  createdBy?: ObjectId; decidedBy?: ObjectId;
  createdAt: Date; updatedAt: Date;
}
```

### SuspensionServiceEntry (the ledger)
```ts
interface SuspensionServiceEntry {
  suspensionId: ObjectId; matchId: ObjectId; playerId: ObjectId; clubId: ObjectId;
  counted: boolean;
  reason: "OFFICIAL_MATCH_PLAYED" | "INTERRUPTED_MATCH_COUNTS" | "FORFEIT_COUNTS"
        | "NO_KICKOFF_DOES_NOT_COUNT" | "CLUB_ABSENT_DOES_NOT_COUNT"
        | "WRONG_COMPETITION" | "WRONG_CATEGORY" | "ALREADY_COUNTED" | "MANUAL_CORRECTION";
  remainingBefore: number; remainingAfter: number;
  processedAt: Date; processedBy?: ObjectId;
}
// UNIQUE INDEX: (suspensionId, matchId) — a match can never be counted twice.
```

### Notification
```ts
interface Notification {
  organizationId: ObjectId;
  recipientUserId?: ObjectId; recipientClubId?: ObjectId;
  type: "NEW_CARD" | "SECOND_YELLOW_WARNING" | "YELLOW_THRESHOLD_REACHED"
      | "RED_CARD_PROVISIONAL_SUSPENSION" | "SUSPENSION_CONFIRMED" | "SUSPENSION_UPDATED"
      | "SUSPENSION_SERVED" | "MATCH_RESCHEDULED" | "MATCH_RESULT_PUBLISHED";
  title: string; message: string;
  relatedEntityType?: string; relatedEntityId?: ObjectId;
  dedupeKey?: string;          // prevents duplicates on finalization retry
  readAt?: Date;
  createdAt: Date;
}
```

### AuditLog (immutable — no update/delete API ever)
```ts
interface AuditLog {
  organizationId: ObjectId;
  actorUserId: ObjectId; actorRole: "FTF_ADMIN" | "CLUB_ADMIN";
  action: string; entityType: string; entityId: ObjectId;
  before?: unknown; after?: unknown;
  reason?: string;
  ipAddress?: string; userAgent?: string; requestId?: string;
  createdAt: Date;
}
// Must audit at minimum: result create/modify, finalization, reopening,
// goal/card modification, suspension create/correct/cancel, rule modification,
// club-user creation, permission-sensitive operations.
```

### Standings (snapshot — always rebuildable)
```ts
interface Standings {
  organizationId: ObjectId; seasonId: ObjectId; competitionId: ObjectId;
  rows: Array<{
    clubId: ObjectId; rank: number; played: number;
    wins: number; draws: number; losses: number;
    goalsFor: number; goalsAgainst: number; goalDifference: number;
    points: number; pointsDeducted?: number;
  }>;
  calculatedAt: Date; calculationVersion: number;
}
```

## 3. Index checklist

| Collection | Index | Type |
|---|---|---|
| users | (organizationId, email) | unique |
| clubs | (organizationId, code) / (organizationId, slug) | unique |
| joueurs | (organizationId, licenceNumber) | unique |
| joueurs | (clubId, status) | query |
| rounds | (organizationId, competitionId, number) | unique |
| matches | (competitionId, roundId) / (homeClubId, scheduledAt) / (awayClubId, scheduledAt) / (status) | query |
| matchevents | (matchId, status) / (playerId, type) | query |
| disciplinarycards | (sourceEventId) | unique |
| disciplinarycards | (playerId, seasonId, accumulationStatus) | query |
| suspensions | (playerId, status) / (clubId, status) | query |
| suspensionserviceentries | **(suspensionId, matchId)** | **unique** |
| notifications | (recipientClubId, readAt) / (dedupeKey) | query / unique-sparse |
| auditlogs | (entityType, entityId) / (actorUserId, createdAt) | query |
| disciplinaryrulesets | (organizationId, seasonId, competitionId, version) | unique |

## 4. Staged `organizationId` migration (spec §7)

1. **Stage A** — create `Organization`, seed FTF org.
2. **Stage B** — add `organizationId` as *optional* to existing schemas; backfill via `scripts/migrations/002-organization.ts`.
3. **Stage C** — flip to `required: true` + add compound indexes; helper `lib/org.ts` resolves org from session; all new queries filter by it.
4. New models are born with `organizationId` required from day one.

## 5. Other migrations (in `scripts/migrations/`)

| Script | Purpose |
|---|---|
| `001-roles.ts` | `ADMIN→FTF_ADMIN`, `CLUB→CLUB_ADMIN` (+ temporary read-compat in auth callbacks) |
| `002-organization.ts` | Stage B backfill above |
| `003-rounds.ts` | Create `Round` docs from distinct `Match.journee` per competition; stamp `roundId` on matches |
| `004-match-status.ts` | Map legacy French statuses to new enum (mapping in Match section above); set `isOfficial: true`, `processingVersion: 0` |
| `005-events.ts` | Copy embedded `Match.evenements[]` into `MatchEvent` collection (status CONFIRMED for homologated matches, DRAFT otherwise); embedded array becomes read-only legacy |
| `006-rulesets.ts` | Create v1 `DisciplinaryRuleSet` per season from `Saison.configuration` |

Every migration: idempotent (safe to re-run), logs a summary, never deletes source data.

## 6. Data-integrity rules

MongoDB **transactions** for finalization/reopen (requires replica set — see [security.md](security.md) & compose changes) · optimistic concurrency via `processingVersion` · unique indexes above · stable event identifiers (`sourceEventId`) · soft archival over deletion · immutable audit logs · rule versioning · deterministic rebuild functions (standings, accumulation, serving) from authoritative events.
