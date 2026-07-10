# Disciplinary Rules — Source Traceability Register

> **Golden rule: never invent a Tunisian disciplinary rule.** Every rule implemented in code must have an entry here. If an official rule is ambiguous, implement it as **configurable** (via `DisciplinaryRuleSet`) and record the assumption. Historical seasons always keep the rule version that was active when their data was recorded.

## 1. Authoritative sources

Use only, in order of preference:
1. Official FTF website publications
2. Latest **FTF Code Disciplinaire**
3. Latest **Règlements Généraux**
4. Official competition-specific regulations
5. Official circulars and amendments

**Latest publicly indexed edition at spec time:** *Code Disciplinaire — Edition Juillet 2025, Fédération Tunisienne de Football.*

> ⚠️ **TO DO before Phase 5 (Discipline Engine) coding starts:** re-search for a newer edition, amendment or circular; if the owner has the official PDF, place it under `docs/sources/` and cite exact article numbers below. Until then, entries below are marked **UNVERIFIED — baseline from product spec**.

## 2. Register

Template per rule:

| Field | Value |
|---|---|
| Rule ID | R-xxx |
| Official document | … |
| Edition date | … |
| Article number(s) | … |
| Business interpretation | … |
| Implementation | model/service + config field |
| Configurable? | yes/no (which `DisciplinaryRuleSet` field) |
| Ambiguity | … |
| Assumption | … |

---

### R-001 — Yellow-card accumulation threshold
- **Official document:** Code Disciplinaire, Edition Juillet 2025 — **UNVERIFIED, article number pending**
- **Interpretation:** A player who receives three warnings (avertissements) in three official matches is automatically suspended for the official match following the third warning.
- **Implementation:** `YellowCardAccumulationService` + `DisciplinaryRuleSet.yellowCardThreshold` (=3) and `yellowCardSuspensionMatches` (=1). Trigger cards → `CONSUMED_BY_SUSPENSION`.
- **Configurable:** yes — threshold and suspension length.
- **Assumption:** suspension is automatic (no committee confirmation needed to become active); admin correction/cancellation requires mandatory reason + audit.

### R-002 — Only official matches count toward accumulation
- **Official document:** Code Disciplinaire — UNVERIFIED
- **Interpretation:** Warnings received in friendly matches do not enter accumulation.
- **Implementation:** `Match.isOfficial` / `Competition.isOfficial` filter in accumulation queries.
- **Configurable:** yes — `yellowCardsCountOnlyOfficialMatches` (default true).

### R-003 — Third yellow in the final competition match
- **Interpretation:** The suspension triggers for the **first applicable official match that follows**, possibly in another competition or the next season.
- **Implementation:** suspension created without a bound "next match"; the serving engine applies it to the first eligible official match.
- **Assumption:** scope resolution follows `DisciplinaryRuleSet.suspensionScope`.

### R-004 — Season-end clearance of unused warnings
- **Interpretation:** Remaining 1st/2nd warnings are cleared at season end.
- **Implementation:** auditable batch operation setting `accumulationStatus = CLEARED_AT_SEASON_END`; cards never deleted.
- **Configurable:** yes — `clearUnusedYellowCardsAtSeasonEnd` (default true).
- **Ambiguity:** whether clearance applies across all competitions or per competition — **implement per rule-set scope; verify against official text.**

### R-005 — Red card ⇒ provisional suspension pending decision
- **Interpretation:** A sent-off player is automatically suspended provisionally and remains suspended until the competent body's decision is recorded. Final decision may be N matches, until-date, cancelled, reduced, or already served via matches missed before the decision.
- **Implementation:** `RedCardDecisionService`; `Suspension.status = PROVISIONAL/PENDING_DECISION`; decision form deducts already-missed eligible matches.
- **Configurable:** `redCardCreatesProvisionalSuspension` (default true).
- **Rule:** never auto-assume a 1-match sanction for a direct red.

### R-006 — Second-yellow dismissal is a single offence
- **Interpretation:** A dismissal after two warnings in the same match (`SECOND_YELLOW_RED`) is one event; the in-match warning(s) leading to it do not additionally continue in yellow accumulation when the graver offence replaces them.
- **Implementation:** `CardType = SECOND_YELLOW_RED`; accumulation service excludes same-match yellows that were absorbed by the dismissal.
- **Ambiguity:** exact treatment of a first-half warning + later direct (not second-yellow) red in the same match — **verify article; until then configurable behavior with default: the yellow remains ACTIVE for accumulation when the red is DIRECT_RED, and is absorbed when SECOND_YELLOW_RED.** (Assumption recorded.)

### R-007 — Suspension carry-over to next season
- **Interpretation:** Remaining suspension matches continue into the next season.
- **Implementation:** `Suspension.sourceSeasonId` preserved; serving ledger records the serving season via the match reference; no season-end expiry of suspensions.

### R-008 — Which matches count as "served"
- **Interpretation:** Only matches that satisfy the official criteria consume a suspension match. Distinctions required: interrupted/stopped match, match that never started, forfeit (team present vs absent, which club caused it), replay ordered, weather interruption, postponed match.
- **Implementation:** `SuspensionService` countability evaluation + `SuspensionServiceEntry.reason` enum; unique `(suspensionId, matchId)` prevents double counting.
- **Ambiguity:** per-case official treatment (e.g. does a forfeit win count for the suspended player's opposing club?) — **each mapping must be verified against the Code; until verified, defaults:** OFFICIAL played counts; no-kickoff does not; forfeit counts unless caused by the player's own club; postponed/cancelled do not. All four defaults are assumptions.

### R-009 — Suspended player participating anyway
- **Interpretation:** Detected participation of a suspended player creates a disciplinary case; sanctions (extra match, match penalty, fine) are decided by the FTF, never applied automatically.
- **Implementation:** anomaly `SUSPENDED_PLAYER_RECORDED_AS_PARTICIPANT` + manual decision workflow.

### R-010 — Friendly-match serious conduct
- **Interpretation:** Serious offences in friendlies can still open a disciplinary case even though ordinary accumulation/serving excludes friendlies.
- **Implementation:** manual suspension path (`MANUAL_DISCIPLINARY_DECISION`) always available regardless of match officiality.

### R-011 — Club responsibility for monitoring
- **Interpretation:** Clubs are responsible for tracking their players' suspension counts.
- **Implementation:** club portal surfaces (suspensions, remaining, source, ledger, next applicable match) per spec §6.8 — a product obligation, not an engine rule.

---

## 3. Verification workflow

1. At the start of Phase 5: search FTF official site for the current Code Disciplinaire edition + circulars.
2. For each R-entry: fill document name, edition date, article numbers; flip **UNVERIFIED → VERIFIED**.
3. Where the official text contradicts a default above: change the `DisciplinaryRuleSet` default, note the correction here, and add/adjust the corresponding tests in [testing.md](testing.md).
4. Any rule that stays ambiguous after reading the official text remains configurable with its assumption documented here.
