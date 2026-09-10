# Scholaris API — Postman collection

A complete, runnable mirror of the v1 API (spec section 21). It is updated in the
same change as the endpoint, never afterwards.

| File | What it is |
| --- | --- |
| `Scholaris.postman_collection.json` | The collection, Postman schema v2.1 |
| `Scholaris.postman_environment.json` | `baseUrl`, token and id variables for local work |

Current coverage: **8 folders, 44 requests, 180 saved example responses** — one
example for every status code each endpoint can return, success and failure
alike.

## Import

1. Postman → Import → both JSON files.
2. Select the **Scholaris — Local** environment.
3. Run **Auth → Get session** first. Its post-response script captures
   `schoolId` and `userId` into collection variables, and every later request
   reads them. The collection then runs top to bottom with no manual copying.

## Signing in

The `accessToken` variable is the bearer token.

**Locally**, with `DEV_AUTH_ENABLED=true` on the server, set it to
`mock-token:<email>` for any seeded user — no Firebase project required:

```
mock-token:admin@brightfield.edu.ng      School administrator
mock-token:principal@brightfield.edu.ng  Principal
mock-token:teacher@brightfield.edu.ng    Teacher and form teacher of JSS 1 Gold
mock-token:bursar@brightfield.edu.ng     Bursar
mock-token:admin@rivercrest.edu.ng       Administrator of the second school
```

Switching between the first four is the quickest way to see permission
enforcement: a bursar calling `POST /academics/levels` gets a 403, and a teacher
listing classes sees only the ones they teach.

**In production** this is a Firebase ID token. The `mock-token:` form is refused
outright — the server will not even start with `DEV_AUTH_ENABLED` set and
`NODE_ENV=production`.

## Checking tenant isolation

The seed creates two schools deliberately. Sign in as
`mock-token:admin@rivercrest.edu.ng`, then set `schoolId` to Brightfield's id and
send any request: it comes back 403, because the header names a school that
user has no membership in. `X-School-Id` selects among the caller's own
memberships and never grants access on its own.

## The envelope

Every response, success or failure, uses one of two shapes, so a client needs a
single parser:

```jsonc
// success
{ "success": true, "data": { }, "message": "Optional" }

// failure
{ "success": false, "error": { "code": "NOT_FOUND", "message": "…", "details": [] } }
```

Error codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `VERSION_CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## Regenerating

The collection is generated rather than hand-edited, so the 180 examples stay
consistent. When you add an endpoint, add it to the generator and re-run it,
then commit both JSON files.

Validate that the output parses before committing:

```bash
node -e "require('./postman/Scholaris.postman_collection.json')"
```
