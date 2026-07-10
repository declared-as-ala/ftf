# Architecture Audit — Current State of the FTF Repository

> Audit date: 2026-07-10. Source of truth: the code itself, not any prior description.
> Classification legend: ✅ works · 🟡 incomplete · 🔁 duplicated · 🔴 needs redesign · ♻️ reusable · 🗑️ candidate for removal (documented — nothing is deleted without approval).

## 1. Entry points

| Path | Role | Status |
|---|---|---|
| `app/page.tsx` | Root redirect: session → `/admin` or `/club`, else `/login` | ✅ |
| `app/login/page.tsx` | Credentials login form | 🟡 works, but renders demo credentials and wipes all cookies via JS before each submit (dev hack) |
| `app/clear-cookies/page.tsx` | Cookie-wipe utility page | 🗑️ dev workaround; gate to dev or remove after approval |
| `middleware.ts` | Role routing (`/admin` ↔ `/club`), login redirects | ✅ — but matcher **excludes `/api`**, so every API route must self-authorize |
| `app/layout.tsx` | Root layout: SessionProvider + ThemeProvider (dark mode) | ✅ ♻️ |

## 2. Authentication flow

- `lib/auth.ts` — NextAuth v5, Credentials provider, bcrypt compare, JWT strategy.
- JWT/session carry: `id`, `role ('ADMIN'|'CLUB')`, `clubId`, `clubName`, `clubLogo` (typed in `types/next-auth.d.ts`).
- 🔴 Findings:
  - Fallback secret `'fallback-secret-key-change-in-production'` at `lib/auth.ts:84`.
  - No user `status`, no lockout, no rate limiting, no `mustChangePassword`, no session revocation.
  - `trustHost: true` unconditionally.
  - Roles are `ADMIN`/`CLUB` — spec requires `FTF_ADMIN`/`CLUB_ADMIN` (migration needed).
- ✅ Password hashing (bcrypt, cost 10) is correct. Email normalized to lowercase.

## 3. Database connection

- `lib/db.ts` — cached global mongoose connection. ✅ pattern is correct.
- 🔴 Falls back to `mongodb://localhost:27017/ftf` silently when `MONGODB_URI` missing.
- 🔴 **`.env.local` contains a live Atlas URI + secret and the values were shared in conversation — rotation required (user action).**

## 4. Models (`lib/models/`) — 12 files

| Model | Status | Notes |
|---|---|---|
| `User.ts` | 🟡 | Only email/password/role/clubId. Missing: name, status, lockout fields, createdBy. Password not `select: false`. |
| `Club.ts` | 🟡 ♻️ | Good base. Missing: code, slug, shortName, status, unique indexes beyond nom/email. |
| `Joueur.ts` | 🟡 ♻️ | Good base; `licence` unique ✅. `stats` embedded counters are manually seeded (not derived). Missing status. |
| `Staff.ts` | ♻️ | Fine for scope; not central to the new product. |
| `Arbitre.ts` | 🔴 **TS error** | Interface declared `Arbitre`, used as `IArbitre` in `Schema<IArbitre>`/`Model<IArbitre>` → `tsc --noEmit` fails. |
| `Match.ts` | 🟡 | Embedded `evenements[]`, `feuilleMatchElectronique`, `homologue` flag. Missing: roundId, isOfficial, finalization metadata, processingVersion, forfeit fields, richer status enum. |
| `Competition.ts` | 🟡 🔁 | Embedded `classement[]` never initialized anywhere → dead weight and a second standings "truth". Missing: tieBreakers, isOfficial, ruleSet link, code. |
| `Saison.ts` | 🟡 ♻️ | Has `configuration` (seuilCartonsJaunes, suspensionCartonRouge) — the seed of the future DisciplinaryRuleSet. Missing status/code/isCurrent semantics. |
| `Discipline.ts` | 🟡 | Rich sanction model but only `matchesRestants` counter — no ledger, no accumulation status, no scope. Will be superseded by DisciplinaryCard + Suspension (kept for history). |
| `Evenement.ts` | 🟡 | Club-incident model (huis clos, amendes). No API/UI uses it. Future module. |
| `Licence.ts` | 🗑️→frozen | Full workflow model, zero API/UI. **Frozen as future module** (spec §6). |
| `Transfert.ts` | 🗑️→frozen | Same — frozen future module. |

## 5. Services (`lib/services/`)

| Service | Status | Notes |
|---|---|---|
| `discipline.service.ts` | 🟡 ♻️ | `traiterCartonJaune/Rouge`, `decrementerSuspensions`, `getPlayerAvailabilityForMatch`. Decrement logic is naive (any club match decrements — violates spec §5.5). Availability logic is reusable as EligibilityService seed. **Never called by any route except availability.** |
| `match.service.ts` | 🔴 dead | `homologuerMatch()` + `updateClassement()` — **no route calls them**. Seed sets `homologue: true` directly. `updateClassement` no-ops because `classement` is never initialized. Superseded by MatchFinalizationService + StandingsService; keep with `@deprecated` header. |

## 6. API routes (`app/api/`) — 12 route files

All admin routes correctly check `session.user.role !== 'ADMIN'` → 401. None use zod. None paginate. None audit.

| Route | Methods | Status |
|---|---|---|
| `admin/clubs` | GET/POST/PUT/DELETE | ✅ CRUD works · 🔴 hard DELETE, unsafe logo upload to `public/uploads` |
| `admin/clubs/[id]` | GET | ✅ aggregate club detail (players/staff/fixtures/results) |
| `admin/joueurs` | GET/POST/PUT/DELETE | ✅ CRUD · 🔴 hard DELETE, unsafe photo upload |
| `admin/arbitres` | GET/POST/PUT/DELETE | ✅ CRUD · 🔴 same upload issue |
| `admin/competitions` | GET/POST | 🟡 create ignores clubs/journees/format details |
| `admin/saisons` | GET/POST | 🟡 minimal |
| `admin/matchs` | GET/POST/PUT/DELETE | ✅ CRUD with referential checks (clubs≠, existence) · 🔴 hard DELETE, no round concept |
| `admin/matchs/[id]` | GET/PUT | 🟡 GET recomputes score from goals on read; PUT allows score/status edits **even on homologated matches** |
| `admin/matchs/[id]/events` | POST/PUT/DELETE | 🔴 side-effects: auto-sets `statut='Terminé'` when a goal is assigned; recalculates score; no finalization guard; deleting a card leaves any (hypothetical) discipline record orphaned |
| `admin/matchs/[id]/availability` | GET | ✅ ♻️ calls DisciplineService availability |
| `admin/standings` | GET | 🔁 dynamic standings recompute — second implementation next to embedded `classement` |
| `auth/[...nextauth]` | GET/POST | ✅ |

**Zero `/api/club/*` routes exist.**

## 7. Pages

### Admin (`app/admin/`)
| Page | Status |
|---|---|
| `page.tsx` (dashboard) | ✅ stats cards + quick actions (one link `/admin/discipline` → 404) |
| `clubs/page.tsx` (489 L) | ✅ list + create/edit/delete modals (raw useState forms, no RHF/zod) |
| `clubs/[id]/page.tsx` (463 L) | ✅ detail with players/staff/matches |
| `joueurs/page.tsx` (562 L) | ✅ list + CRUD modals |
| `matchs/page.tsx` (493 L) | ✅ results/fixtures/standings tabs |
| `matchs/[id]/page.tsx` | ✅ detail + events + PlayerAvailability |
| `arbitres/page.tsx` (503 L) | ✅ list + CRUD |
| `classement/page.tsx` (223 L) | ✅ reads `/api/admin/standings` |

Sidebar (`components/Sidebar.tsx`) links to **8 non-existent admin pages**: staff, competitions, discipline, transferts, licences, evenements, saisons, settings → 404.

### Club (`app/club/`)
Only `page.tsx` (dashboard — server-rendered, correctly scoped by `session.user.clubId` ✅) + layout. Sidebar links to **7 non-existent pages**: joueurs, staff, matchs, discipline, transferts, licences, statistiques → 404.

## 8. Components

| Component | Status |
|---|---|
| `components/ui/*` (badge, button, card, input, label, skeleton, table) | ✅ ♻️ shadcn-style kit — keep |
| `Navbar.tsx`, `Sidebar.tsx` | ✅ ♻️ (sidebar link lists need rework) |
| `PlayerAvailability.tsx` | ✅ ♻️ good pattern for eligibility UI |
| `Loader.tsx`, `LoadingButton.tsx` | ✅ ♻️ |
| `hooks/usePlayerAvailability.ts` | 🗑️ **unused** — `PlayerAvailability.tsx` fetches directly. Keep or wire in later; do not delete without approval. |

## 9. Validation, forms, tests

- **zod**: dependency installed, **zero usage** in the codebase.
- **react-hook-form**: installed, **zero usage** — all forms are raw `useState` + `FormData`.
- **Tests**: none (no test files, no test runner configured, no `test` script).

## 10. Seed & scripts

- `scripts/seed.ts` (490 L): 1 admin, 6 real Tunisian clubs + club users, 132 players, staff, 4 referees, 1 season w/ discipline config, 1 competition, ~10 journées of finished matches (with goal/card events, `homologue: true` set directly — **bypassing all discipline processing**) + 5 journées scheduled.
- 🔴 Wipes the entire database unconditionally (`deleteMany({})` on all collections); no production guard; hardcoded credentials printed to console.

## 11. Docker & deployment

- `Dockerfile`: ✅ good multi-stage, standalone output, non-root user.
- `docker-compose.yml`: 🔴 mongo:7 **standalone** (no replica set → **MongoDB transactions unavailable**), hardcoded root credentials, port 27017 published to host, no healthchecks.
- `next.config.ts`: `output: 'standalone'` (conflicts with runtime writes to `public/uploads`), permissive `remotePatterns: hostname '**'`, deprecated `images.domains`.

## 12. Documentation

- `README.md`: default create-next-app boilerplate.
- `INSTALLATION.md`, `QUICKSTART.md`, `START_HERE.md`: **empty** placeholder files.
- `TROUBLESHOOTING.md`: dev-era JWT-cookie troubleshooting + demo credentials (contains secrets-adjacent info).
- `CLAUDE.md`, `NEXTSTEP.md`: created 2026-07-10 (project brief + roadmap pointer).

## 13. Feature completion matrix

Legend: ✓ exists · ✗ missing · ~ partial. "Complete" = genuinely usable end-to-end per spec.

| Feature | Model | API | Service | UI | Validation | AuthZ | Tests | Complete |
|---|---|---|---|---|---|---|---|---|
| Authentication (login/logout) | ✓ | ✓ | — | ✓ | ~ | ✓ | ✗ | ~ (insecure defaults) |
| User management (create club admins…) | ~ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| Clubs CRUD | ✓ | ✓ | — | ✓ | ~server-manual | ✓role | ✗ | ~ |
| Players CRUD | ✓ | ✓ | — | ✓ | ~ | ✓role | ✗ | ~ |
| Referees CRUD | ✓(buggy TS) | ✓ | — | ✓ | ~ | ✓role | ✗ | ~ |
| Staff | ✓ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| Seasons | ✓ | ~(GET/POST) | ✗ | ✗ | ✗ | ✓role | ✗ | ✗ |
| Competitions | ✓ | ~(GET/POST) | ✗ | ✗(tab only) | ✗ | ✓role | ✗ | ✗ |
| Journées (rounds) | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| Matches CRUD | ✓ | ✓ | — | ✓ | ~ | ✓role | ✗ | ~ |
| Match events (goals/cards) | ✓embedded | ✓ | — | ✓ | ~ | ✓role | ✗ | ~ (unsafe side-effects) |
| Match finalization/homologation | ~flag | ✗ | ✓dead | ✗ | ✗ | — | ✗ | ✗ |
| Yellow-card accumulation | ~ | ✗ | ✓unused | ✗ | ✗ | — | ✗ | ✗ |
| Red-card decisions | ~ | ✗ | ~unused | ✗ | ✗ | — | ✗ | ✗ |
| Suspension serving (ledger) | ✗ | ✗ | ✗(naive decrement) | ✗ | ✗ | — | ✗ | ✗ |
| Player eligibility | — | ✓(availability) | ✓ | ✓ | — | ✓role | ✗ | ~ (reads suspensions that nothing creates) |
| Standings | ~embedded+API | ✓ | ✓dead | ✓ | — | ✓role | ✗ | ~ (no forfeits/deductions/H2H/rebuild) |
| Notifications | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| Audit log | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| Reports/exports | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| Settings / rule configuration | ~(Saison.configuration) | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| Club portal (beyond dashboard) | — | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| Licences | ✓ | ✗ | ✗ | ✗ | ✗ | — | ✗ | frozen |
| Transfers | ✓ | ✗ | ✗ | ✗ | ✗ | — | ✗ | frozen |

## 14. Duplicated / inconsistent / dead

- 🔁 Standings: `MatchService.updateClassement` (embedded) vs `/api/admin/standings` (dynamic) — two implementations, neither complete.
- 🔁 Upload helpers: near-identical `saveLogoFile`/`savePlayerPhoto`/`saveArbitrePhoto` in three routes → one `lib/uploads.ts`.
- 🔁 `unwrapIdParam` helper copy-pasted in 4 route files.
- 🔁 Score recomputation from goals duplicated in `matchs/[id]` GET and events route.
- Dead: `MatchService.homologuerMatch`, `hooks/usePlayerAvailability.ts`, `Competition.classement`, `Evenement`/`Licence`/`Transfert` models (frozen), `feuilleMatchElectronique` (out of scope — match sheets excluded).
- Naming: French domain (`Joueur`, `matchs`, `classement`) mixed with English (`standings`). Decision D1: keep French model names; new models in English; new API namespace `matches` with `matchs` aliases during transition.

## 15. Reusable assets to preserve

`components/ui/*`, Navbar/Sidebar shell, PlayerAvailability pattern, `lib/db.ts`, admin CRUD pages (as UI shells to be refit onto new APIs), seed's realistic Tunisian club/player data, Dockerfile, `DisciplineService.getPlayerAvailabilityForMatch` (seed of EligibilityService), `Saison.configuration` (seed of DisciplinaryRuleSet).
