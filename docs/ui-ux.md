# UI / UX Direction

> Goal: a **professional federation administration platform** — not a fan site, not a generic template. Preserve the existing shadcn-style kit (`components/ui/*`), Navbar/Sidebar shell and dark mode; extend deliberately.

## 1. Visual identity

| Token | Use |
|---|---|
| White / light-neutral backgrounds | Base surfaces |
| Charcoal / deep navy | Primary text, navigation |
| **Tunisian red** | Main accent — used sparingly (primary actions, brand). **Do not overuse red** |
| Green | Available / success / SERVED |
| Orange | Warning / at-risk (2 yellows) |
| Red | Suspended / critical |
| Blue | Pending decisions (PROVISIONAL, PENDING_DECISION) |
| Gray | Archived / completed / LOCKED |

Status→color semantics are consistent everywhere (badges, tables, timelines). FTF logo/assets only from the repo (`public/icon.png`, `public/uploads/clubs/*`) or supplied by the owner — never scraped/hotlinked.

## 2. Layout

**Desktop:** collapsible left sidebar (exists ✅) · top bar with: global search, current-season selector, competition selector, notification bell, user menu (to add — current Navbar has logo + theme toggle + logout only).

**Mobile/tablet:** responsive drawer navigation · cards replace very wide tables · sticky primary action on data-entry screens (journée result entry) · touch-friendly inputs. Note: current club layout uses fixed `ml-64` without responsive fallback — fix when touched.

## 3. Navigation

- **Admin sidebar:** Dashboard · Seasons · Competitions · Journées · Matches · Clubs · Players · Discipline · Standings · Reports · Notifications · Users · Audit · Settings.
- **Club sidebar:** Dashboard · Players · Matches · Calendar · Cards · Suspensions · Eligibility · Standings · Notifications · Profile.
- Consistent lucide icons; subpages via nested navigation/tabs, not a crowded flat sidebar. Current `components/Sidebar.tsx` link lists are replaced by these (removing today's 15 dead links) as their pages ship.

## 4. Component inventory

**Existing — keep:** `ui/badge, button, card, input, label, skeleton, table` · `Navbar` · `Sidebar` · `PlayerAvailability` · `Loader` · `LoadingButton`.

**To create (shared, in `components/`):**
PageHeader · Breadcrumbs · SeasonSelector · CompetitionSelector · StatusBadge (status→color map) · ClubAvatar · PlayerAvatar · MatchCard · ScoreDisplay · MatchTimeline (goals+cards by minute) · CardBadge (🟨/🟨🟥/🟥 + accumulation status) · SuspensionBadge · EligibilityBadge (available/at-risk/suspended/pending) · RoundProgress (x/y matches official) · DataTable (server pagination, sorting, column visibility, row actions) · FilterBar · EmptyState · ErrorState · ConfirmationDialog (destructive variant with mandatory-reason input) · AuditTimeline · NotificationItem · StatCard · FormDrawer · DocumentViewer.

Build each component when its first consumer page ships — no speculative component dumps.

## 5. Required page states

Every page supports: loading (skeleton) · empty state · error state · permission denied · success feedback (toast/inline) · form validation messages · unsaved-changes warning on dirty forms.

## 6. Tables

Server-side pagination · search · filters · sorting · responsive collapse to cards · clear row actions · column visibility where useful. Never load all records into the browser.

## 7. Forms

react-hook-form + zodResolver (schemas shared with the server from `lib/validators/`) replaces the current raw `useState` forms as each page is reworked. Mandatory-reason fields for integrity-sensitive actions (reopen, amend, cancel) are enforced in both client schema and server schema.

## 8. Accessibility

Keyboard navigation · visible focus rings · proper labels (`Label` htmlFor present in kit ✅) · accessible dialogs (focus trap, esc, aria) · semantic table markup · sufficient contrast in both themes · screen-reader-friendly status text (not color-only).

## 9. Language, localization, time

- **French** is the default product language.
- Localization-ready structure: UI strings centralized (e.g. `lib/i18n/fr.ts` as the starting dictionary) rather than hard-coded through large components; architecture prepared for Arabic + RTL later (logical CSS properties where practical, `dir` attribute plumbed at root).
- Dates stored in **UTC**; displayed in **Africa/Tunis** via a shared formatting helper (`lib/datetime.ts`) — replaces scattered `toLocaleDateString('fr-FR')` calls as pages are touched.

## 10. Key screens (UX priorities)

1. **Journée result-entry** (`/admin/competitions/[id]/rounds/[roundId]`) — the flagship: match grid, inline bulk score entry, per-match drawer for goals/cards, draft/finalize states, sticky save/finalize bar, filters. Optimize for speed of data entry after a weekend of matches.
2. **Match detail** — tabbed (overview/goals/cards/discipline impact/audit) with strong confirmations on finalize/reopen/forfeit.
3. **Discipline dashboard** — KPI-first, drill-down tabs; "at risk" and "pending decision" always one click away.
4. **Club dashboard** — next-match card with unavailable-player count front and center (club responsibility per regulations).
5. **Suspension detail** — the ledger rendered as a timeline; every change shows its reason and actor.
