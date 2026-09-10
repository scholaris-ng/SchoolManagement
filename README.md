# Scholaris

A multi-tenant school management platform: admissions, students and guardians,
attendance, curriculum coverage, results and report cards, fees and payments,
behaviour and safeguarding, and parent communication — built for schools with
unreliable connectivity.

> **Status.** The React client is complete and builds clean. The Express/TypeORM
> API is scaffolded and phase 1 of the implementation order is done: tenancy,
> identity, RBAC, audit, school settings, the public website and the academic
> structure — 44 endpoints. Students, guardians, attendance, results and finance
> follow. Screens whose endpoints do not exist yet still run against the
> in-browser mock API, see [Running without a backend](#running-without-a-backend).

## Repository layout

This is an npm workspace, so dependencies install once at the root and both
packages resolve up into the shared `node_modules`.

```
client/    React + TypeScript + Vite frontend
server/    Express + TypeORM + PostgreSQL API
apphosting.yaml    Firebase App Hosting build and runtime configuration
ARCHITECTURE.md    Layering, data ownership and adapter boundaries
DEPLOYMENT.md      Firebase App Hosting + PostgreSQL checklist
PRODUCT_ROADMAP.md Feature phases
```

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer for the API, local or managed
- For production: a Firebase project (Auth, Firestore, Storage, Cloud
  Messaging) and a PostgreSQL database

## Getting started

Install once, from the repository root:

```bash
npm install
```

**Interface only**, no database or Firebase project needed:

```bash
cp client/.env.example client/.env
npm run dev:client
```

The app runs at <http://localhost:5173> against the mock API and mock
authentication.

**Full stack**, against a real database:

```bash
cp server/.env.example server/.env     # point DB_* (or DATABASE_URL) at PostgreSQL
npm run migration:run
npm run seed -w @school/api
npm run dev:api                        # http://localhost:4000/api/v1
```

Then set `VITE_USE_MOCK_API=false` in `client/.env` and run `npm run dev:client`.
The client already proxies `/api` to port 4000. With `DEV_AUTH_ENABLED=true` on
the server, sign in as a seeded persona with no Firebase project — see
[server/README.md](server/README.md).

### Scripts (run from the repository root)

| Command | What it does |
| --- | --- |
| `npm run dev:client` | Vite dev server with `/api` proxied to `VITE_DEV_API_PROXY` |
| `npm run dev:api` | API in watch mode |
| `npm run build` | Builds both packages |
| `npm run lint` | ESLint across both, warnings treated as errors |
| `npm run typecheck` | `tsc --noEmit` across both |
| `npm test` | Vitest for the client, Jest for the API |
| `npm run migration:run` | Applies pending database migrations |
| `npm run migration:revert` | Rolls the last migration back |

Add `-w @school/client` or `-w @school/api` to run a package's own scripts, for
example `npm run test:watch -w @school/client` or `npm run seed -w @school/api`.

## Running without a backend

`VITE_USE_MOCK_API=true` starts a Mock Service Worker layer that implements the
REST contract the API is specified to expose: the same success/failure
envelopes, pagination, permission checks and tenant scoping. Feature code cannot
tell the difference, so pointing the client at the real server later is a
configuration change rather than a rewrite.

`VITE_USE_MOCK_AUTH=true` adds sign-in shortcuts for seeded personas — a school
administrator, principal, form teacher, bursar, parent, student, and an
administrator at a *second* school for checking tenant isolation by hand.

Both flags are forced off in production builds, and the mock bundle, its seeded
data and the MSW worker script are all excluded from `dist/` — verify with:

```bash
cd client && npm run build && ls dist && grep -rl "msw\|DEMO_PERSONAS" dist/ || echo "clean"
```

## Demo deployments

Until the API exists, a deployed build has nothing to talk to — signing in
returns 404 from `/api/v1/auth/session`. Building with `VITE_DEMO_MODE=true`
produces a *demo* bundle instead: it keeps the mock API and the persona sign-in
shortcuts, and every screen carries a banner saying the data is invented.

On Vercel, set `VITE_DEMO_MODE` to `true` in the project's environment variables
and redeploy. Locally:

```bash
cd client && VITE_DEMO_MODE=true npm run build && npm run preview
```

It must be asked for at build time and cannot be switched on from the browser,
so an ordinary production build still compiles the mocks out entirely. Never set
it on a deployment a real school will use.

`src/mocks/demo-smoke.test.ts` runs the mock handlers under Node and checks that
every persona signs in, each dashboard responds, and neither seeded school can
see the other's records — so a broken demo fails in CI rather than on a
published URL.

## Environment variables

Copy `client/.env.example` to `client/.env`. Everything prefixed `VITE_` is
compiled into the browser bundle and is therefore **public** — Firebase web
config is public by design, but service accounts and API secrets belong on the
server.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | REST base path; `/api/v1` (same origin) in production |
| `VITE_DEV_API_PROXY` | Where `vite dev` proxies `/api` (default `http://localhost:4000`) |
| `VITE_APP_URL` | Public app URL, used in verification links and QR codes |
| `VITE_USE_MOCK_API` | Run against the in-browser mock API (development only) |
| `VITE_USE_MOCK_AUTH` | Bypass Firebase and sign in as a seeded persona (development only) |
| `VITE_DEMO_MODE` | Build a demo deployment that keeps the mock API and personas |
| `VITE_FIREBASE_*` | Firebase web configuration |
| `VITE_FIREBASE_VAPID_KEY` | Public VAPID key for web push |

Configuration is parsed and validated once at startup (`src/lib/env.ts`), so a
misconfigured deployment fails loudly instead of misbehaving inside a feature.

## Frontend architecture

Organised by feature, not by file type:

```
src/
  app/          Router, layouts, auth and theme providers
  components/   Reusable UI: data tables, forms, dialogs, guards, charts
  features/     One folder per domain: students, admissions, results, finance…
  hooks/        Cross-feature hooks (list state, outbox, media queries)
  lib/          Transport, env, permissions, storage, formatting, Excel, push
  mocks/        Development API (compiled out of production builds)
  types/        The wire contract shared with the API
```

Some conventions worth knowing before adding to it:

- **One transport.** Every request goes through `lib/http.ts`, which attaches
  the Firebase ID token and the active school. No feature calls `fetch`.
- **Server state is TanStack Query.** Each feature owns an `api.ts` of hooks;
  components never duplicate fetching logic.
- **Cache keys carry the tenant.** `queryKeys` namespaces everything under the
  active school, so switching school cannot surface another school's rows.
- **List state lives in the URL.** `useListQuery` keeps search, filters, sort
  and paging in the query string, which makes a filtered view shareable and
  survives refresh and the back button.
- **Permissions, not roles.** UI is gated on granular permissions
  (`result.publish`, not `PRINCIPAL`), so a school-defined role behaves
  correctly. This is UX only — the API remains the authority.
- **Honest sync state.** Work queued offline is labelled *waiting to sync*, and
  never presented as saved.

### Adding a feature module

1. Add the wire types to `src/types/`.
2. Add `src/features/<name>/api.ts` with TanStack Query hooks, using
   `queryKeys` for cache keys.
3. Build the page from the shared components (`DataTable`, `FilterBar`,
   `PageHeader`, `EmptyState`, `ErrorState`) so it inherits the responsive,
   accessible and loading/error behaviour.
4. Register the route in `src/app/router.tsx`, wrapped in the permission it
   requires, and add the navigation entry in `src/app/navigation.ts`.
5. While the API is unimplemented, add a handler in `src/mocks/handlers/`.

## Notifications and web push

Firebase Cloud Messaging is a delivery *channel*; notification records and
per-category preferences belong to the API. `src/lib/push.ts` handles browser
permission and token retrieval, and registers
`public/firebase-messaging-sw.js` for background delivery — the Firebase web
config reaches the worker through its query string, because a service worker
cannot read the bundle's environment. Push requires
`VITE_FIREBASE_VAPID_KEY` plus a complete Firebase web config; without them the
notification settings screen says so plainly instead of offering a switch that
does nothing.

## Child data and privacy

The product holds records about children, and the client is built to match:

- Student photographs are suppressed wherever consent is not recorded.
- The public school website is generated only from content entered on the
  Website settings screen; no student record can reach it.
- Public document verification (`/verify/:code`) confirms a document is genuine
  without exposing the student's record.
- Retention-risk analytics is framed as a prompt to contact a family, never as
  grounds to exclude a child.

## Testing

```bash
cd client && npm test
```

Covers permission evaluation, tenant-scoped cache keys, Excel import/export
parsing, and the pages where a mistake would be most costly: the parent
portal's child scoping, role and permission editing, the audit trail, and
retention risk. `src/test/harness.tsx` renders a page with the providers it gets
in the app; pass `dataRouter: true` for pages that use `UnsavedChangesGuard`.

## Building and deploying

```bash
cd client && npm run lint && npm run typecheck && npm test && npm run build
```

Output lands in `client/dist/`. See [DEPLOYMENT.md](DEPLOYMENT.md) for the
Firebase App Hosting and PostgreSQL checklist. Once the API exists, note the
routing order that App Hosting needs — `/api/*` to Express, `/assets/*` to the
static build, everything else to `index.html` — with the API registered
**before** the SPA fallback.

## Not yet implemented

- The entire `server/` API (Express, TypeORM entities, migrations, repositories,
  use cases, RBAC enforcement, payment gateways, notification channels).
- Firestore-backed realtime messaging: the messaging UI currently reads through
  the REST contract; the Firestore adapter lands with the server.
- `apphosting.yaml` and CI/CD, which depend on the server's build and start
  commands.
