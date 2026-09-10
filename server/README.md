# Scholaris API

Express + TypeORM + PostgreSQL, TypeScript throughout, run under `tsx`.

Phase 1 of the spec's implementation order is complete: tenancy, identity, RBAC,
the audit trail, school settings, the public website, and the academic
structure. Students, guardians, attendance, results and finance follow in later
phases.

## Getting started

```bash
# from the repository root — this is an npm workspace
npm install

npm run migration:run -w @school/api
npm run seed        -w @school/api
npm run dev         -w @school/api    # http://localhost:4000/api/v1
```

Copy `.env.example` to `.env` first and point the `DB_*` variables at a
PostgreSQL instance, or set `DATABASE_URL` instead. Every variable is validated
at startup; the process refuses to boot on an invalid configuration rather than
failing later on the first request that needs a missing value.

Development currently runs against a managed PostgreSQL 18 instance on Aiven,
configured in `.env`. Nothing in the code assumes that — `DB_SSL=false` and a
local host work identically.

The client's `VITE_DEV_API_PROXY` already points at `http://localhost:4000`, so
setting `VITE_USE_MOCK_API=false` in `client/.env` switches the finished UI onto
this API.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | `tsx watch` on `server.ts` |
| `npm start` | Production entrypoint, also through `tsx` |
| `npm run typecheck` | `tsc --noEmit`, zero errors required |
| `npm run lint` | ESLint, warnings treated as errors |
| `npm test` | Jest |
| `npm run migration:run` | Applies pending migrations |
| `npm run migration:revert` | Rolls the last one back |
| `npm run migration:generate -- src/infrastructure/database/migrations/Name` | Diffs entities against the live schema |
| `npm run schema:log` | Prints the DDL needed to reconcile entities and schema — should print none |
| `npm run seed` | Development seed; refuses to run in production |
| `npm run postman` | Regenerates the Postman collection |

## Signing in without Firebase

Firebase Admin is not configured yet, so `DEV_AUTH_ENABLED=true` accepts
`Authorization: Bearer mock-token:<email>` for any seeded user — the same form
the client's mock identity provider already sends. It resolves an existing user
and creates nobody. It is refused outright when `NODE_ENV=production`: the
process will not start with both set.

Seeded accounts:

```
admin@brightfield.edu.ng      School administrator
principal@brightfield.edu.ng  Principal
teacher@brightfield.edu.ng    Teacher, form teacher of JSS 1 Gold
bursar@brightfield.edu.ng     Bursar
admin@rivercrest.edu.ng       Administrator of the second school
```

## Layering

Each layer owns one thing and never reaches past its neighbour:

```
route → auth → tenant → authorise → validate → controller → service → repository → entity
```

- **Controllers** read only from `req.validated`, never `req.body`, and return
  the `ApiResponse` envelope.
- **Services** hold every business rule, throw `AppError`, and know nothing
  about HTTP.
- **Repositories** hold every query. Tenant-scoped ones extend
  `TenantRepository`, whose query builder starts from a `schoolId` predicate, so
  a cross-tenant query takes deliberate effort rather than a lapse.
- **Entities** are columns, indexes and relations only.

## Multi-tenancy

`X-School-Id` is a hint about which of the caller's own memberships they mean,
never a grant. Tenant resolution reads the membership from PostgreSQL on every
request and takes `schoolId` from that row, so a forged header selects nothing.

The seed creates two schools on purpose: a single-tenant seed cannot catch a
query that forgot its `schoolId`, because every row belongs to the only school
there is.

## Two things that will bite you

**Explicit column types are mandatory.** `tsx` compiles through esbuild, which
does not implement `emitDecoratorMetadata`. TypeORM therefore cannot infer a
column's type from its TypeScript type. A `@Column()` without an explicit `type`
compiles and lints cleanly, then throws `ColumnTypeUndefinedError` when the
entity loads.

**Never run an entrypoint with plain `node`.** The require graph is TypeScript
throughout. Use `tsx`, including for the TypeORM CLI — `typeorm.cli.ts` wraps it
so it resolves through the hoisted workspace `node_modules`.

## Response envelope

```jsonc
{ "success": true,  "data": { }, "message": "Optional" }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "…", "details": [] } }
```

This follows `Dev Prompt.txt` section 35 and the client's parser in
`client/src/lib/http.ts`. It deviates from `server_arch.md` section 5, which
flattens errors alongside a `statusCode`; the client is the binding contract
here, and every other rule in `server_arch.md` is followed unchanged.

## API documentation

`postman/` holds a runnable mirror of the API: 44 requests with a saved example
for every status code each can return. See `postman/README.md`.
