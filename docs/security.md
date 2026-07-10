# Security — Vulnerabilities Found & Required Controls

> Severity: **P0** = blocker (fix before any feature work) · **P1** = required before production · **P2** = important hardening.

## 1. Vulnerabilities found in the audit (2026-07-10)

| # | Finding | Location | Severity | Fix |
|---|---|---|---|---|
| S1 | **Live MongoDB Atlas URI + NEXTAUTH_SECRET committed** in `.env.local`; values also appeared in chat | `.env.local` | **P0** | **User action: rotate Atlas password + generate new NEXTAUTH_SECRET.** If repo was ever pushed, purge history. Add `.env.example`, never commit real values (`.gitignore` already covers `.env*.local` ✅) |
| S2 | Fallback JWT secret `'fallback-secret-key-change-in-production'` | `lib/auth.ts:84` | **P0** | Remove; fail fast at boot if `NEXTAUTH_SECRET` missing |
| S3 | Silent localhost DB fallback | `lib/db.ts:4` | **P0** | Fail fast if `MONGODB_URI` missing |
| S4 | Demo credentials rendered on the login page; cookie-wiping JS hack on submit | `app/login/page.tsx` | **P0** | Remove both; `/clear-cookies` page gated to dev |
| S5 | Seed wipes the entire DB unconditionally, prints hardcoded credentials | `scripts/seed.ts` | **P0** | Refuse when `NODE_ENV=production`; require `--force` to wipe |
| S6 | Unsafe file uploads: client-controlled extension, no MIME sniff, no size cap, written into `public/` (served statically → stored-XSS vector via e.g. `.html`/`.svg`) | `api/admin/{clubs,joueurs,arbitres}` | **P0** | Shared `lib/uploads.ts`: magic-byte MIME whitelist (png/jpeg/webp), 2 MB cap, server-generated name+extension |
| S7 | Events/score editable on homologated matches — silently corrupts derived data | `api/admin/matchs/[id]`, `.../events` | **P0** | Guard: reject mutations when finalized; later replaced by reopen workflow |
| S8 | Mongo standalone in compose → **no transactions possible**; root creds hardcoded; port 27017 published | `docker-compose.yml` | **P0/P1** | Single-node replica set for dev; creds from env; don't publish DB port beyond dev |
| S9 | No login rate limit, no lockout, no user status check | `lib/auth.ts`, `User` model | **P1** | `failedLoginAttempts` + `lockedUntil` + `status` enforcement in authorize() and session callback |
| S10 | No zod — all mutating routes parse raw input manually | all routes | **P1** | `lib/validators/*` adopted route by route |
| S11 | No audit logging anywhere | — | **P1** | `AuditLog` + `AuditService` (see [database.md](database.md)) |
| S12 | Unbounded `.find()` on every list endpoint (DoS / data-dump vector) | all list routes | **P1** | Server-side pagination with hard cap |
| S13 | No `/api/club/*` isolation layer exists yet (club pages query DB directly server-side — currently OK, but portal expansion needs enforced scoping) | `app/club/page.tsx` | **P1** | `requireClub()` helper; clubId from session only |
| S14 | Error handlers return `error.message` in some routes (internal leakage) | e.g. `matchs/[id]` PUT | **P2** | `apiError()` sanitized responses + request IDs |
| S15 | `images.remotePatterns: hostname '**'` (any host) + deprecated `images.domains` | `next.config.ts` | **P2** | Restrict to needed hosts |
| S16 | No security headers, no explicit cookie/session config | `next.config.ts`, auth | **P2** | Headers (CSP, X-Frame-Options, nosniff, referrer-policy); session `maxAge`; secure cookies in prod |
| S17 | `trustHost: true` unconditional | `lib/auth.ts` | **P2** | Acceptable behind known proxy; document; restrict if possible |
| S18 | Middleware matcher excludes `/api` (by design) — any future route forgetting self-authorization is exposed | `middleware.ts` | note | Convention: **every** route starts with `requireAdmin()`/`requireClub()`; enforced by authorization tests |

## 2. Required controls (target state — spec §16)

### Authentication & sessions
- bcrypt hashing (present ✅, cost 10) · JWT sessions with explicit `maxAge` · secure cookies in production · `status` (ACTIVE/SUSPENDED/INVITED/DISABLED) checked at login **and** in session callback (revocation path for disabled users) · `mustChangePassword` flow · login rate limiting + failed-attempt lockout · no seeded credentials in production; production admin created via bootstrap script.

### Authorization (server-side, layered)
- Middleware = routing convenience only. **Every API route and every domain service enforces RBAC.**
- Object-level authorization: club admins only reach own-club objects (players, cards, suspensions, non-shared match data) — cross-club access returns 403/404 (IDOR protection).
- Club identity always derived from session; client-supplied `clubId` ignored on club routes.
- Admin namespaces (`/api/admin/*`) require `FTF_ADMIN`.

### Input & data safety
- zod validation on every mutating route (mass-assignment protection via explicit schemas).
- NoSQL-injection safety: only validated primitives into queries; never raw client objects.
- Pagination limits (hard cap) on all list endpoints.
- File uploads: MIME sniffing, size caps, server-generated names, private storage + ownership-checked download for disciplinary documents (decision documents are NOT world-readable).

### Operational
- Sanitized API errors + request IDs · immutable audit log for every sensitive mutation (with mandatory `reason` for corrections/cancellations/reopens) · no public MongoDB exposure · environment secret validation at boot · no cross-user caching of club-scoped data (all club responses `no-store` or per-user keyed) · CSRF: NextAuth cookies + same-site; state-changing routes require authenticated session (verify SameSite config in prod).

## 3. Secrets policy

- `.env.example` lists every variable with placeholder values; real values only in untracked `.env.local` / deployment secrets.
- Boot-time validation: app refuses to start without `MONGODB_URI` and `NEXTAUTH_SECRET` (no fallbacks).
- Rotation events (like S1) documented in [progress.md](progress.md).

## 4. Definition of done (security) per phase

A batch that adds an endpoint is complete only when: authorization helper used · zod schema present · pagination if list · audit entry if sensitive mutation · authorization test added (admin-only route rejects CLUB_ADMIN + anonymous; club route rejects cross-club access).
