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

## 11. Referee registry and assignment UX (future approved module)

### Referee list

Use one Lucide `UserRound` icon in a circular/rounded deep-navy or neutral avatar container. Do not require or emphasize photos, use external image URLs, or render a broken legacy photo. A responsive table/card shows full name, code/licence, category, city/region, status, derived assignment count, availability, and FTF-admin actions. Search and category/status/location filters are server-backed and preserve their state on navigation.

Create/edit uses visible French labels, inline validation, and no photo field in the primary workflow. Archive is preferred over delete and uses a confirmation dialog. Status is text plus badge/icon, never color alone.

### Journée assignment

Extend each match card on `/admin/competitions/[competitionId]/rounds/[roundId]` with a clearly separated `Désignation des arbitres` region:

- searchable `Arbitre principal` select first;
- `Ajouter des assistants` progressive disclosure for the two assistants and fourth official;
- visible `Brouillon`, `Désignation publiée`, `Mise à jour`, or `Annulée` badge;
- secondary `Enregistrer le brouillon` and one primary `Publier la désignation` action;
- conflict errors adjacent to the official field, with the conflicting match/date named and a recovery action;
- published edits open a reason-required confirmation flow before save/publish.

Desktop may use compact rows; at 375 px each match becomes a vertically ordered card with controls at least 44 px high and no horizontal scroll. Loading uses stable skeletons; empty, error, denied, and retry states are explicit. All selects/actions are keyboard operable with visible focus.

### Admin match detail

Add an `Officiels` tab showing the current version, status, four roles, timestamps/actors, assignment history, previous versions, and change reason. Internal data is visually marked as administration-only and is never reused in club components.

### Club match surfaces

The first next-match card on `/club/dashboard` is visually dominant and fully clickable, with an explicit `Voir les détails du match` button. It shows opponent/logo, home/away, competition/journée, date/time, stadium, status, unavailable-player count, and only published officials. Without publication it shows `Arbitre non encore désigné`.

`/club/matches` includes the published main referee in upcoming and previous rows/cards. `/club/matches/[id]` groups officials in an official information card: main referee, assistants, fourth official, main category, and publication date. It never includes notes, audit, actors, contact details, or internal change reasons.

The UI/UX review reinforces the existing institutional direction: semantic navy/neutral surfaces, restrained status colors, Lucide-only icons, 4.5:1 text contrast, non-color status labels, responsive cards, 44 px touch targets, and no decorative fan imagery.

## 12. Manual club-notification UX (future approved module)

### Admin dashboard

Add a compact `Notifications aux clubs` card/section without displacing the main operational dashboard. Show total unread club deliveries, recently sent count, the last manual notification, and two clear links: `Créer une notification` and `Voir les notifications`. Counts must have textual labels and must not rely on color.

### Admin notification workspace

Extend `/admin/notifications` with `Notifications envoyées` and `Créer une notification` areas (tabs or an equivalent predictable navigation). History starts with KPI cards for total, current month, clubs reached, unread deliveries, manual and automatic notifications. The responsive history table/card shows title, source/type, recipient summary, sender, sent date, read/unread counts, status, and actions for detail, duplicate, and archive. There is no edit-delivered action and no admin mark-read control.

Filters are server-backed: manual/automatic, all/specific recipients, club, category, status, date range, and debounced safe text search. Preserve filters and page when returning from detail.

### Composer, preview, and confirmation

Desktop uses a balanced two-column layout: form as the primary column and a sticky-but-non-obstructive live preview/recipient summary as the secondary column. On small screens the form comes first and preview follows; no horizontal scrolling.

- `Destinataires` uses three explicit options. Single/multiple modes progressively reveal searchable active-club controls; multi-select shows chips and an announced selected count, prevents duplicates, and remains keyboard operable.
- Category and priority have visible French labels. Priority uses text plus semantic badge/icon: normal neutral/blue, important orange, urgent red. Urgent is never oversized or animated.
- `Titre` and `Message` have persistent labels, inline errors, and visible `current/max` character counters. Message preview preserves line breaks as safe text.
- Optional action label/link and expiration are grouped under an `Options` section. Invalid internal links explain the permitted route pattern.
- Preview shows source/category/priority, title, full safe-text message, optional action, expiration, and an authoritative recipient summary. Client estimates are labelled provisional until server validation.
- `Envoyer la notification` opens an accessible confirmation dialog showing recipient count, title, and priority. Focus is trapped/restored, Escape cancels, and the send button exposes a non-repeating loading state.

Success announces `Notification envoyée avec succès` through a polite live region and links to detail/history. Validation errors focus the first invalid field. A transaction failure shows that nothing was delivered and offers retry with the same idempotency key; no ambiguous partial-success toast.

### Club dashboard and notification center

`/club/dashboard` adds `Notifications de la FTF` with at most 3–5 latest non-expired relevant items, prioritizing unread urgent/important items without permanently suppressing recency. Each shows source, priority, category, title, short preview, date, unread indicator, and safe action when present, plus `Voir toutes les notifications`.

`/club/notifications` combines manual and automatic notices with `Toutes`, `Non lues`, `Importantes`, `Urgentes`, and category filters. Cards show full plain-text content with preserved line breaks, sent date, source (`Notification automatique`/`Notification manuelle`), the appropriate FTF sender identity, priority/category, read state, and optional internal action. Provide `Marquer comme lue` and `Tout marquer comme lu`; no edit, delete, recipient list, or audit affordance.

All controls meet a 44 px target, retain visible focus, work without hover, and use Lucide icons consistently. Loading uses stable skeletons; empty, permission-denied, validation, sending, success, expired, archive, and recoverable error states are designed explicitly at 375/768/1024/1440 px.

## 13. Official admin match workspace (future; approval gated)

Retain the established institutional navy/neutral visual system. The sports-marketing palette suggested by a generic design-system search is intentionally rejected for this operational federation workspace; restrained semantic green/amber/red remains reserved for state and risk.

### Persistent header and navigation

The match header is compact and remains recognizable across tabs: breadcrumb/back to journée, competition and journée, club crests/names, score, text status badge, date/time, stadium/city, published main referee, and one contextual primary action (`Modifier`, `Finaliser`, `Rouvrir`, or `Télécharger le rapport`). Destructive/exception actions stay secondary and require confirmation. On mobile the header becomes stacked cards; it never compresses the clubs into unreadable columns.

Use a real WAI-ARIA tab pattern for `Vue d’ensemble`, `Résultat`, `Buts`, `Cartons`, `Discipline`, `Arbitres`, `Historique`: `tablist`/`tab`/`tabpanel`, arrow-key navigation, Home/End, visible focus, selected state beyond color, URL-deep-linkable tab, and scrollable tab strip only—not horizontal page scrolling. The primary action remains outside the tab strip.

### Tab behavior

- `Vue d’ensemble`: public match facts, status/validation summary, goal/card counts, discipline warnings, notes/report availability, and last transition. It is a summary, not a duplicate edit form.
- `Résultat`: draft-only score/metadata form with persistent labels, inline validation, dirty-state warning, explicit save, and version-conflict recovery. Score override is a collapsed exception flow with reason/explanation and a strong confirmation.
- `Buts`: chronological list/table plus focused add/edit sheet. Club selection filters players; assist cannot equal scorer; own-goal explanation names the credited opponent. Duplicate warnings do not erase valid same-minute events.
- `Cartons`: chronological cards with visible type labels, accumulation impact preview, report reference, and provisional-red consequence. Second yellow explains that it will not count as another ordinary accumulation card.
- `Discipline`: read-only impact timeline/cards for generated/served suspensions, next affected match, notifications, and open anomalies. Confirming an anomaly requires policy text and a reason.
- `Arbitres`: Phase 9 assignment component/history when available; otherwise a clearly labelled legacy read-only summary—never a second assignment editor.
- `Historique`: reuse `AuditTimeline` with actor, action, timestamp, reason and safe before/after summary. Internal payload blobs are not rendered raw.

### Forms, feedback, and responsive states

Prefer focused drawers/dialogs for one event rather than an oversized all-fields modal. Every field has a visible French label; errors appear next to the field and in a concise summary that focuses the first error. Saving/finalizing disables only conflicting actions and exposes non-repeating progress text. Success returns focus to the originating control and announces through a polite live region.

Each tab owns stable skeleton, empty, error, permission-denied, draft/read-only, and official states. Empty states say what is absent and offer the permitted next action. Do not use emoji as structural event icons; reuse Lucide icons and existing `CardBadge`, `SuspensionBadge`, `EligibilityBadge`, `ConfirmationDialog`, `AuditTimeline`, and form/card primitives. Minimum target size is 44 px, body text contrast is at least 4.5:1, and all essential behavior works at 375/768/1024/1440 px without hover.

### Club match detail

The club page may reuse the visual score header and chronological event components in read-only mode, but consumes a separate allowlisted public DTO. It shows own-club unavailability/at-risk information and official public events; opponent confidential discipline, admin notes, override rationale, referee reports, audit, draft events, and internal actions never have placeholder containers or client-side hidden fields.
