# End-to-end tests

Cypress specs for the Scholaris client. Read this before writing one.

## Running them

```bash
npm run e2e          # start the app in e2e mode, run every spec, shut down
npm run e2e:open     # same app, interactive runner
npm run dev:e2e      # just the app in e2e mode, if you want to drive it yourself
```

`npm run e2e` starts the dev server itself and waits for it, so nothing else
needs to be running first.

## The golden rule — stub first, never touch real data

Every spec is **fully network-stubbed** with `cy.intercept()`. No spec calls a
real API, and no spec reads or writes a real database.

This is not a style preference. Dev and production share a database on this
project, so a test that reaches "the dev API" reaches real school records.

Two things enforce it:

1. `npm run dev:e2e` runs Vite with `--mode e2e`, which loads `.env.e2e`. That
   file points the dev proxy at **`http://127.0.0.1:9`** — the discard port,
   which nothing ever listens on. A request a spec forgot to stub is refused
   instantly. It cannot leak data, and it cannot quietly pass.
2. `.env.e2e` also sets `VITE_USE_MOCK_API=false`. MSW would otherwise answer
   the very requests a spec is trying to stub, and the test would prove nothing.

## Envelope

Stub bodies must mirror the wire contract in `src/types/api.ts` exactly — that
is what the transport layer parses. Build them with `cypress/support/api.ts`
rather than by hand:

| Helper | Produces |
| --- | --- |
| `ok(data)` | `{ success: true, data }` |
| `paged(items)` | `ok({ items, meta })` — a paginated list |
| `listMeta(total)` | just the `PageMeta` block |
| `fail(message, code?)` | `{ success: false, error: { code, message } }` |
| `validationFailure(details)` | a 422 body with field-level messages |

Pair `fail(...)` with a non-2xx `statusCode` on the intercept: the transport
reads the HTTP status and the envelope together.

## Custom commands

Use these; don't reinvent them.

| Command | Purpose |
| --- | --- |
| `cy.dataCy("id")` | The **only** sanctioned selector style |
| `cy.login(role?, overrides?)` | Stubbed session — seeds the mock persona in `localStorage` and stubs `/auth/session` plus the unread-count poll the shell makes on every screen |
| `cy.logout()` | Clears that session |
| `cy.interceptApi(method, path, response, alias)` | Intercepts one `/api/v1` path |
| `cy.stubDashboard(role?)` | Dashboard payloads (`@dashboard`, `@terms`) |
| `cy.waitForLoader()` | Waits out the full-page loader |
| `cy.loginByApi(email, password)` | Real sign-in via `cy.session()` — **live smoke specs only**, read-only |

`cy.login()` takes this product's roles, not generic ones: `admin`,
`principal`, `teacher`, `bursar`, `parent`, `student`. Their permissions come
from the same role matrix the app uses (`src/mocks/personas.ts`), so a
permission added to a role cannot drift out of the suite.

Call `cy.visit()` once before `cy.login()` — the command writes to
`localStorage`, which needs an origin to write to.

## Selectors

Every interactive element carries a `data-cy` attribute, added at build time and
never changing behaviour.

Most of them come for free from the shared components, so a new screen usually
needs no new attributes at all:

| Component | Yields |
| --- | --- |
| `TextField`, `NumberField`, `SelectField`, … | `field-<name>` — the react-hook-form path |
| `<DataTable data-cy="students-table">` | `students-table`, `-row` (one per row, each with `data-row-id`), `-empty`, `-error`, `-error-retry`, `-sort-<column>`, `-select-all`, `-select-<rowId>` |
| `<FilterBar>` | `filter-search`, `filter-<key>`, `filter-chip-remove-<key>`, `filter-reset` |
| `<Pagination>` | `pagination-first`, `-prev`, `-next`, `-last`, `-page-<n>`, `-size` |
| `<FormActions>` | `form-submit`, `form-cancel` |
| `<FormError>` | `form-error` |
| `<ConfirmDialog>` | `confirm-dialog`, `-confirm`, `-cancel`, `-phrase` |
| `<Select>` | the trigger, plus `<cy>-option-<value>` per option |
| Sidebar / tabs | `nav-<path>`, `tab-<id>`, `page-tab-<path>` |

**Never** select by CSS hierarchy, `nth-child`, generated class names, or
visible text. Asserting on text is fine; locating by it is not.

## Layout

```
cypress/
  e2e/<feature>/<journey>.cy.ts     one folder per feature area, kebab-case specs
  e2e/live/                         opt-in read-only smoke specs — see its README
  fixtures/<domain>/<name>.json     stub payloads, grouped per domain
  support/api.ts                    envelope builders + URL matcher
  support/session.ts                the stubbed session `cy.login()` installs
  support/commands.ts               custom commands (typed)
  support/e2e.ts                    global setup
```

## What a journey must cover

At minimum, per journey:

- the happy path;
- one validation failure;
- one API error (`fail(...)` with a non-2xx `statusCode`).

Plus, for anything role-gated, an access-control test: the allowed role sees it,
the blocked role is redirected or does not get the control.

Tests are independent. Each one logs in and stubs everything it needs; never
depend on state a previous test left behind. Stub **before** `cy.visit()`, and
wait on aliases — never `cy.wait(5000)`.

Run `npm run e2e` before handing work over. All specs must pass.
