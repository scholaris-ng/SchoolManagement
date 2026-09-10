# Firebase/Firestore Setup & AI Agent Scaffold Guide

> **Purpose:** This document is the authoritative scaffold guide for introducing Firebase (specifically Firestore) into a project that already has a primary relational database. It is written from real setup sessions — every command, every gotcha, and every dead end here actually happened. Follow it in order; skipping steps is what produces the failures documented in §7.
>
> **Revised after a second setup**, on a multi-tenant SaaS whose users have real Firebase identities. That surfaced three places where following the original text literally caused a failure: the blanket read rule leaks across tenants (§1.2), one IAM role is not always enough (§7.7), and a placeholder project id bricks the CLI (§7.9). It also added a way to *verify* the Console-only steps instead of trusting them (§6.6). If you are building anything multi-tenant, read §1.2 before §6.3.

---

## 1. Core Philosophy

| Principle | Description |
|---|---|
| **Firestore is a realtime fan-out layer, not a replacement database** | Reach for it when a feature specifically needs live updates across open clients (comments, live status, presence, collaborative editing) — not as a general-purpose datastore alongside your existing SQL database. |
| **Server-mediated writes by default** | The server (Admin SDK) is the only writer. Business logic, ownership checks, and moderation stay in your existing service layer — never duplicated into Firestore security rules. Clients only ever open realtime *read* listeners. |
| **Anonymous auth for read access only** | *Applies only when your clients have no Firebase identity of their own.* Clients sign in anonymously purely to satisfy "must be authenticated to read." If your app already uses Firebase Auth for real sign-in, skip anonymous entirely and rely on the real identity — see §1.2, and do **not** copy the blanket read rule below. |
| **Least privilege, always** | Never `Editor`/`Owner`. Grant the *minimum set of roles that actually work* — usually just `roles/datastore.user`, but a server that also creates or manages Firebase credentials needs `roles/firebaseauth.admin` too (§7.7). "Exactly one role" is a rule of thumb, not the principle; the principle is that every role present must be necessary. |
| **Verify functionally, not structurally** | "The API returned 200" is not verification. Write a real document through the actual code path, read it back, delete it. See §6.5. |

### 1.1 When to break from "server-mediated writes"

If a feature genuinely needs client-authoritative writes (offline-first editing, direct peer-to-peer-feeling collaboration), the alternative is: bridge your app's own auth into Firebase via **custom tokens** (`admin.auth().createCustomToken(userId)` server-side, `signInWithCustomToken()` client-side), and move ownership/moderation logic into Firestore security rules. This is significantly more setup and duplicates authorization logic in two places (your API layer's rules + Firestore's rules) — only take this path when asked for it specifically, and treat it as a distinct architectural decision requiring the same sign-off as any other (see `ai_agent_flow_backend.md` §18 SOLID/Dependency Inversion — the same principle that makes a repository swap invisible to the service layer is what makes the "server-mediated" default clean).

### 1.2 Multi-tenant apps: `allow read: if request.auth != null` is a data leak

**Read this before copying the rules template in §6.3.** That blanket rule is safe only under a narrow assumption: every signed-in client is entitled to read every document in the collection. That holds for anonymous auth over public-ish data. It is catastrophically wrong for a multi-tenant product.

If your clients sign in as real people, `request.auth != null` means *any* authenticated user of your platform — a parent at one school, a customer of one tenant, a trial account someone opened five minutes ago. A blanket read rule hands each of them every other tenant's documents.

The write side stays exactly as §1 describes (`allow write: if false`, Admin SDK only). What changes is that reads must be scoped to the caller:

```
match /conversations/{id} {
  // The server writes participantUids as the Firebase uids of the people in the thread.
  allow read: if request.auth != null && request.auth.uid in resource.data.participantUids;
  allow write: if false;
}

match /notifications/{id} {
  allow read: if request.auth != null && request.auth.uid == resource.data.userId;
  allow write: if false;
}
```

This is **not** the "business logic in rules" that §1 warns against. Ownership, moderation and validation still live in your service layer. Tenant isolation on the read path is the one thing rules must do that your API cannot, because the client talks to Firestore directly and your API is not in that path at all. Scoping reads is the minimum correct rule, not an optional hardening step.

To make it enforceable, the server must write a caller-identifying field (`participantUids`, `userId`, `tenantId` + a membership lookup) onto every document at creation time. Design that in at §2 step 5, not after the leak.

---

## 2. Setup Checklist — Run in This Order

Every step below is annotated with **[CLI]** (can be scripted/automated) or **[CONSOLE]** (must be done by a human in the Firebase Console — no reliable API path, don't waste time trying to script it).

```
[ ] 0.  [CLI]     Confirm WHICH ACCOUNT both CLIs are logged into, before anything
                  else. `gcloud auth list` and `firebase projects:list`. If the
                  target project is missing from either, you are in the wrong
                  account — stop and have the human re-login (§7.4). Do not
                  conclude "the project doesn't exist" and offer to create one;
                  that is the single most expensive wrong turn in this whole
                  process, and it looks identical to a genuinely absent project.
[ ] 1.  [CLI]     Confirm the target GCP project ID. If deploying elsewhere already
                  (Cloud Run, App Engine, etc.), reuse that same project — Firestore
                  is just another API on it, not a new project.
[ ] 2.  [CLI]     Windows only: point CLOUDSDK_PYTHON at gcloud's bundled Python
                  before running anything else (see §7.1) — gcloud will silently
                  fail otherwise. Set it PERSISTENTLY, not with `export` in one
                  shell, or it breaks again in the next terminal (§7.1).
[ ] 3.  [CLI]     gcloud services enable firestore.googleapis.com --project=<PROJECT>
                  Then POLL until it takes effect — the command returns success
                  well before the API is usable, and the very next call fails with
                  "API has not been used in project ... before or it is disabled"
                  (§7.8).
[ ] 4.  [CLI]     gcloud firestore databases create --project=<PROJECT>
                  --location=<REGION> --type=firestore-native
                  — pick <REGION> to match your existing compute (Cloud Run region,
                  etc.) for latency, unless you need multi-region durability.
[ ] 5.  Design the collection(s): what document shape, what fields are denormalized
                  (Firestore has no JOIN — author names, counts, etc. must be written
                  redundantly at write time; see §4.3 and §4.4).
                  MULTI-TENANT: decide NOW which field on each document identifies
                  who may read it (participantUids, userId, …). Security rules can
                  only scope reads to a field that exists, and adding one later
                  means backfilling every document (§1.2).
[ ] 6.  [CLI]     Create composite indexes your queries need:
                  gcloud firestore indexes composite create --project=<PROJECT>
                    --collection-group=<name>
                    --field-config field-path=<f1>,order=ascending
                    --field-config field-path=<f2>,order=ascending
                  Any query combining >1 `where`/`orderBy` on different fields needs
                  one of these — Firestore will refuse the query at runtime with a
                  console link to auto-create it if you skip this step, but doing it
                  ahead of time avoids a broken first deploy.
[ ] 7.  [CONSOLE] Authentication → Get Started. This is NOT the same as enabling a
                  sign-in provider — it's a one-time product initialization with no
                  reliable API equivalent found. Skipping this produces
                  CONFIGURATION_NOT_FOUND (see §7.3).
[ ] 8.  [CONSOLE] Authentication → Sign-in method → enable the provider(s) you need.
                  Anonymous for the read-only pattern in §1; Email/Password (or
                  whatever your app actually signs in with) if your clients have
                  real identities. Enabling the WRONG provider fails at sign-in
                  with OPERATION_NOT_ALLOWED, not at setup time.
[ ] 8b. [CLI]     VERIFY steps 7 and 8 actually happened — do not take "yes I did
                  it" on trust, and do not wait for a human to confirm. One REST
                  call proves both (§6.6). This is the highest-value check in the
                  list: it converts two unverifiable Console steps into a test.
[ ] 9.  [CONSOLE] Project Settings → General → Add app → Web app. Copy the resulting
                  apiKey/authDomain/projectId — these are NOT secret (Firestore
                  access is gated by security rules, not by hiding this config) and
                  go straight into the client's public env vars.
[ ] 10. Write firebase.json, .firebaserc, firestore.rules, firestore.indexes.json
                  at the repo root (templates in §6).
                  .firebaserc: leave it as {"projects":{}} until you know the real
                  project id. A placeholder like <PROJECT_ID> or REPLACE_ME breaks
                  EVERY firebase command, including ones that take no project (§7.9).
[ ] 11. [CLI]     firebase login (confirm it's the account with access to the
                  project — `firebase projects:list` to check; a stale login to an
                  unrelated account is a common silent failure, see §7.4)
                  firebase deploy --only firestore:rules,firestore:indexes \
                    --project <PROJECT> --non-interactive
[ ] 12. [CLI]     Create a least-privilege service account for local dev:
                  gcloud iam service-accounts create <name>-dev --project=<PROJECT>
                  gcloud projects add-iam-policy-binding <PROJECT>
                    --member=serviceAccount:<name>-dev@<PROJECT>.iam.gserviceaccount.com
                    --role=roles/datastore.user
                  PLUS, if your server creates/updates Firebase users or calls
                  verifyIdToken with the revocation check:
                    --role=roles/firebaseauth.admin
                  (datastore.user alone gives auth/insufficient-permission — §7.7)
                  gcloud iam service-accounts keys create <tmpfile> --iam-account=...
                  — then move the key into your local env config (§7.6) and delete
                  the temp file. NEVER reuse a deploy/CI service account key for
                  this — different blast radius, different lifecycle.
                  Verify afterwards that the account holds ONLY the roles you meant:
                  gcloud projects get-iam-policy <PROJECT>
                    --flatten="bindings[].members"
                    --filter="bindings.members:<SA_EMAIL>"
                    --format="value(bindings.role)"
[ ] 13. [CLI]     Grant the SAME role(s) to your deployed runtime's service account
                  (Cloud Run's default is the Compute Engine default SA unless you
                  configured a custom one — `gcloud run services describe <name>
                  --region=<region> --format="value(spec.template.spec.serviceAccountName)"`
                  to find it). No key file needed there — Application Default
                  Credentials via the metadata server picks it up automatically.
                  Skip this until something is actually deployed; note it as
                  outstanding rather than inventing a service account to grant to.
[ ] 14. Wire env vars — server: FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT_JSON
                  (local dev only; unset on the deployed platform so ADC is used).
                  Client: VITE_FIREBASE_API_KEY / VITE_FIREBASE_AUTH_DOMAIN /
                  VITE_FIREBASE_PROJECT_ID (or your framework's env prefix).
[ ] 15. Verify functionally end-to-end (§6.5) before considering this done.
```

---

## 3. Architecture Pattern (Server-Mediated Writes)

```
Write path:
  Client -> your existing REST/API endpoint -> your existing service layer
           (ownership/moderation/business logic — UNCHANGED)
         -> repository writes to Firestore via Admin SDK
           (Admin SDK bypasses security rules entirely)

Read path:
  Client -> anonymous Firebase sign-in (once, cached)
         -> onSnapshot() realtime listener directly against Firestore
           (gated only by security rules: read if authenticated, write: false)
```

The repository swap is the whole trick: give the Firestore-backed repository **the exact same method signatures** (`fetchPaginated`, `findById`, `create`, `softDelete`, …) as whatever repository it's replacing. The service layer above it doesn't change at all — this is Dependency Inversion, not a special case.

---

## 4. Server-Side Code Patterns

### 4.1 The Firestore client — lazy singleton with a credential guard

```js
// infrastructure/firestore/firestoreClient.js
const os = require("os");
const path = require("path");
const fs = require("fs");
const { initializeApp, applicationDefault, cert, getApps } = require("firebase-admin/app");
const { getFirestore: getFirestoreInstance, FieldValue } = require("firebase-admin/firestore");
const { env } = require("../../config/env");

let firestore = null;

// gcloud auth application-default login writes here — the Google Auth Library
// checks this path even without GOOGLE_APPLICATION_CREDENTIALS set.
function hasLocalAdcFile() {
  const base = process.platform === "win32"
    ? path.join(process.env.APPDATA || "", "gcloud")
    : path.join(os.homedir(), ".config", "gcloud");
  return fs.existsSync(path.join(base, "application_default_credentials.json"));
}

// K_SERVICE is set automatically on Cloud Run (and similar) — the metadata-server
// credential path only actually works there, never on a developer machine.
function isConfigured() {
  return Boolean(
    env.firebase.serviceAccountJson ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE ||
      hasLocalAdcFile()
  );
}

// CRITICAL — see §7.2. Without this guard, calling applicationDefault() with no
// credential source available fails deep inside the SDK's gRPC channel setup via a
// promise that ISN'T part of the awaited call chain — it crashes the whole process
// as an unhandled rejection instead of rejecting your write/read call. Failing
// synchronously here, before the SDK is ever touched, is what makes a normal
// try/catch around your repository calls actually reliable.
function getFirestore() {
  if (!isConfigured()) {
    throw new Error("Firestore is not configured — set FIREBASE_SERVICE_ACCOUNT_JSON or run where ADC is available");
  }
  if (firestore) return firestore;
  if (!getApps().length) {
    initializeApp({
      credential: env.firebase.serviceAccountJson
        ? cert(JSON.parse(env.firebase.serviceAccountJson))
        : applicationDefault(),
      projectId: env.firebase.projectId || undefined,
    });
  }
  firestore = getFirestoreInstance();
  return firestore;
}

module.exports = { getFirestore, FieldValue };
```

**Note the import style**: `require("firebase-admin/firestore")` and `require("firebase-admin/app")`, not `require("firebase-admin")` then `admin.firestore.FieldValue` — modern `firebase-admin` (v12+) doesn't populate that legacy namespaced shape by default. Using it throws `Cannot read properties of undefined (reading 'FieldValue')` at require time.

### 4.2 Repository pattern — every method wrapped, credential errors surfaced as a normal domain error

```js
function unavailable(err) {
  console.error("[myFeature] Firestore error:", err.message);
  return new AppError("This feature is temporarily unavailable", 503);
}

class MyFirestoreRepository {
  async create(data) {
    try {
      const ref = await getFirestore().collection(COLLECTION).add({ ...data, createdAt: FieldValue.serverTimestamp() });
      return toDomainObject(await ref.get());
    } catch (err) {
      throw unavailable(err);
    }
  }
  // findById / fetchPaginated / softDelete follow the same try/catch shape
}
```

### 4.3 No joins — denormalize at write time

Firestore documents can't join to a `users` table. If the client needs a display name, resolve it in the service (which already has the actor/user context for other reasons — auth checks, notifications) and write it onto the document directly:

```js
const author = await this.authRepo.findUserById(actor.id);
await this.repo.create({ authorId: actor.id, authorName: [author.firstName, author.lastName].filter(Boolean).join(" "), ... });
```

### 4.4 Counts — denormalize on the SQL side, not Firestore aggregation queries

If a list view needs "N comments" per row and the rows live in your primary SQL database, don't run a Firestore aggregation query per row. Add a plain denormalized counter column (`comment_count integer default 0`) to the SQL row, and increment/decrement it from the service right after each successful Firestore write:

```js
await this.commentRepo.create({ ... });          // Firestore write
await this.parentRepo.incrementCommentCount(id);  // plain SQL UPDATE ... SET count = count + 1
```

This is **eventually consistent**, not atomic (they're different databases — no single transaction spans both). Document this tradeoff inline; it's a deliberate choice, not an oversight.

---

## 5. Client-Side Code Patterns

### 5.1 The Firestore client — single instance, anonymous auth

**If your app already signs users in with Firebase Auth, skip `ensureFirebaseAuth()` entirely.** The user is already authenticated; calling `signInAnonymously()` would replace their real identity with an anonymous one and break every rule in §6.3b that reads `request.auth.uid`. Wait for the existing auth state instead — `onAuthStateChanged`, or whatever your auth provider already exposes — and open the listener once a user is present. The pattern below is for apps whose clients have no Firebase identity of their own.

```ts
// lib/firestore.ts
import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth, signInAnonymously } from "firebase/auth"

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
})
export const db = getFirestore(app)

let signInPromise: Promise<void> | null = null
export function ensureFirebaseAuth(): Promise<void> {
  if (!signInPromise) signInPromise = signInAnonymously(getAuth(app)).then(() => undefined)
  return signInPromise
}
```

### 5.2 Realtime hook — subscribe on mount, clean up on unmount

```ts
export function useLiveComments(parentId: string) {
  const [data, setData] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    if (!parentId) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    ensureFirebaseAuth()
      .then(() => {
        if (cancelled) return
        const q = query(
          collection(db, "comments"),
          where("parentId", "==", parentId),
          where("deletedAt", "==", null),
          orderBy("createdAt", "asc")
        )
        unsubscribe = onSnapshot(q, (snap) => { setData(snap.docs.map(toComment)); setIsLoading(false) },
          () => { setIsError(true); setIsLoading(false) })
      })
      .catch(() => { setIsError(true); setIsLoading(false) })

    return () => { cancelled = true; unsubscribe?.() }
  }, [parentId])

  return { data, isLoading, isError }
}
```

Mutations (create/delete) still go through your normal API endpoints — don't call Firestore write methods from the client at all under the server-mediated pattern. The realtime listener picks up the change on its own once the server writes it; you generally don't need to manually invalidate/refetch the list after a successful mutation, only any denormalized counters shown elsewhere (§4.4).

---

## 6. Config File Templates

### 6.1 `firebase.json`
```json
{ "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" } }
```

### 6.2 `.firebaserc`
```json
{ "projects": { "default": "<PROJECT_ID>" } }
```

**Do not write the literal placeholder.** The Firebase CLI validates this file on startup for *every* command, so `<PROJECT_ID>` or `REPLACE_WITH_PROJECT_ID` makes even `firebase projects:list` fail with `Error: Invalid project id`. Until you know the real id, write an empty map, which the CLI accepts:

```json
{ "projects": {} }
```

### 6.3 `firestore.rules` — default server-mediated pattern

**Single-tenant / anonymous-auth only.** If real people sign in, use §6.3b instead — this version leaks across tenants (§1.2).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /<collection>/{docId} {
      allow read: if request.auth != null;
      allow write: if false;   // Admin SDK bypasses rules entirely — this blocks clients only
    }
  }
}
```

### 6.3b `firestore.rules` — multi-tenant, real user identities

Helper functions must be declared **inside** a `match` block. Putting them at `service` level looks tidier and fails to compile (§7.10).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isParticipant(participantUids) {
      return isSignedIn() && request.auth.uid in participantUids;
    }

    match /conversations/{conversationId} {
      allow read: if isParticipant(resource.data.participantUids);
      allow write: if false;

      match /messages/{messageId} {
        // Re-read the parent rather than trusting a field on the message, so a
        // document cannot widen its own audience.
        allow read: if isParticipant(
          get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantUids
        );
        allow write: if false;
      }
    }

    match /notifications/{notificationId} {
      allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow write: if false;
    }

    // Firestore denies by default; state it anyway so the intent is explicit.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Two costs to know about. `get()` inside a rule is a billed document read and counts against the rules evaluation limit, so use it for nested collections rather than on every top-level document. And `resource.data` is null for a document that does not exist, so a rule reading it denies rather than errors — which is the behaviour you want, but it means "not found" and "not yours" are indistinguishable to the client. That is a feature, not a bug: it stops existence probing.

### 6.4 `firestore.indexes.json`
```json
{
  "indexes": [
    {
      "collectionGroup": "<collection>",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "<parentId>", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 6.5 Functional verification — run this before calling the setup done

Structural checks (API enabled, database exists, IAM binding present) are necessary but not sufficient. Prove the actual write→read→delete path works through your real code, and clean up after yourself:

```js
const repo = MyFirestoreRepository.Instance;
const doc = await repo.create({ /* throwaway test data */ });
console.log('Write OK:', doc.id);
const fetched = await repo.findById(doc.id);
console.log('Read-back OK:', Boolean(fetched));
await repo.softDelete(doc.id);
await getFirestore().collection(COLLECTION).doc(doc.id).delete(); // fully remove, don't leave test data
console.log('Verified end-to-end.');
```

**When no repository exists yet.** On a greenfield setup you will often wire Firestore before the first feature that uses it, so there is nothing to call. Do not skip verification — go through the same client the app will use, so the credential guard is exercised too:

```ts
if (!isFirestoreConfigured()) throw new Error('Not configured');   // the §4.1 guard
const db = getFirestore();
const ref = await db.collection('_verification').add({ note: 'setup check', createdAt: FieldValue.serverTimestamp() });
const snap = await ref.get();
if (!snap.exists) throw new Error('Wrote a document but could not read it back');
await ref.delete();
if ((await ref.get()).exists) throw new Error('Still present after delete');
```

Keep it as a committed script (`npm run firebase:verify`), not a throwaway. It is the fastest way to answer "did the credentials rot?" six months later.

### 6.6 Verifying the Console-only steps from the CLI

§2 steps 7 and 8 are Console-only, which tempts agents into either blocking on a human or assuming they were done. Neither is necessary. One unauthenticated REST call against Identity Toolkit, using the **public web API key**, proves both:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"<a real user>","password":"<their password>","returnSecureToken":true}' \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$WEB_API_KEY"
```

Read the outcome:

| Response | Means |
|---|---|
| `idToken` returned | Auth is initialised **and** the password provider is enabled. Steps 7 and 8 are done. |
| `CONFIGURATION_NOT_FOUND` | Step 7 was never done — Authentication has no config at all (§7.3). |
| `OPERATION_NOT_ALLOWED` | Step 7 done, step 8 not — that provider is disabled. |
| `EMAIL_NOT_FOUND` / `INVALID_LOGIN_CREDENTIALS` | Both steps are done. The account or password is simply wrong, which still proves the product is configured. |

This is exactly what the client SDK does underneath, so it is a real test rather than a proxy for one. Note that admin-side calls (`listUsers`, `createUser`) are **not** a substitute: they can succeed while browser sign-in still fails, because they authenticate as your service account and never touch the sign-in provider configuration.

The strongest version, if your API accepts Firebase tokens: take the `idToken` from that response and call your own authenticated endpoint with it. That verifies the web config, the provider, token verification, and your API's identity wiring in one pass.

---

## 7. Known Gotchas (all observed firsthand — read before you hit them)

### 7.1 `gcloud` on Windows: "Python was not found"
Symptom: any `gcloud` command triggers a Microsoft Store Python install prompt instead of running. Fix: point `CLOUDSDK_PYTHON` at the SDK's own bundled interpreter before running anything:
```bash
export CLOUDSDK_PYTHON="<path-to-cloud-sdk>/platform/bundledpython/python.exe"
```

Find the interpreter rather than guessing the path — the SDK installs under `%LOCALAPPDATA%`, `%APPDATA%`, or either `Program Files` directory depending on how it was installed:
```powershell
(Get-Command gcloud).Source     # the shim; the SDK root is two levels up from bin\
```

**`export` is not enough.** It lasts one shell. The next terminal — including the human's, and your own next tool call in some setups — breaks again identically, and it is easy to lose ten minutes rediscovering the same fix. Set it once, persistently:
```powershell
[Environment]::SetEnvironmentVariable("CLOUDSDK_PYTHON", $py, "User")
```
Existing terminals need a restart to pick that up; keep exporting it inline for the current session as well.

### 7.2 Server crashes (not a clean error) on the first Firestore write with no credentials configured
Symptom: `Error: Could not load the default credentials` followed by an **uncaught exception that kills the Node process**, even though the write call was wrapped in try/catch. Root cause: `applicationDefault()`'s failure path, when no ADC source exists at all, rejects via a promise deep inside `google-gax`'s gRPC channel setup that isn't part of your awaited call chain — Node treats it as an unhandled rejection, not a normal rejected promise. Fix: the synchronous credential-source guard in §4.1's `getFirestore()` — never let the SDK attempt credential resolution when you already know (from env vars / well-known file paths) that nothing is configured.

### 7.3 `CONFIGURATION_NOT_FOUND` on `signInAnonymously()` / any Identity Toolkit call
Means Firebase Authentication was never initialized for the project at all — not just "the provider isn't enabled," the whole product has no config. `identitytoolkit.googleapis.com` being *enabled* is not sufficient; a plain `GET .../v2/projects/<id>/config` will 404 with this exact message. No reliable API-only fix was found — this needs the Console's Authentication → "Get Started" button once, then the Sign-in method tab to enable specific providers.

### 7.4 Firebase CLI deploys silently target the wrong project / fail with access errors
`firebase login` can be signed into a completely different Google account than the one with access to your target project (easy to not notice — the CLI doesn't warn you). Check with `firebase projects:list` before deploying; re-run `firebase login` with the correct account if your project isn't in the list.

### 7.5 IAM grants and rules deploys need explicit, specific confirmation — every time
If you're an AI agent with access to cloud credentials: expect a safety layer to block IAM policy grants (`add-iam-policy-binding`) and security-rule deployments even after general authorization like "use gcloud" or "go ahead" — these are treated as high-severity because they're persistent changes to a shared/production-adjacent resource. Read-only checks (list, describe, get-iam-policy) and low-risk creates (enabling an API, creating a service account with zero permissions yet) generally don't need this. Before attempting an IAM grant or rules deploy, state the *exact* command/role/resource and get a direct confirmation on that specific action — a confirmation from two turns earlier on a generic description doesn't count.

### 7.6 Never let a raw service-account key pass through a chat/log transcript
Generate keys to a local temp file, transform/insert them into your env config via a script (not by you reading and retyping the value), then delete the temp file. If you need to verify the key was written correctly, check non-secret metadata (`client_email`, `project_id`, byte length) — never print `private_key`.

**This extends to every file you `grep`, not just key files.** Redacting by blacklist fails the moment a file holds a secret you did not anticipate. A single `grep -i firebase` over an old `.env` backup, with a `sed` that redacted only the Firebase fields, printed a live OpenAI key and a Resend key into the transcript — because the grep matched a neighbouring line and the redaction rule had never heard of them.

Redact by **whitelist**: print only the keys you specifically want to see, and mask everything else by default.

```bash
# WRONG — blacklist. Anything unanticipated leaks.
grep -i firebase .env.backup | sed -E 's/(PRIVATE_KEY|PASSWORD)=.*/\1=<redacted>/'

# RIGHT — whitelist. Nothing else can appear.
grep -oE '^(FIREBASE_PROJECT_ID|FIREBASE_AUTH_DOMAIN|FIREBASE_APP_ID)=.*' .env.backup
```

Better still, do not print at all: have a script read the file and report only what you need, the way §2 step 12 handles the key. If a secret does reach the transcript, say so immediately and plainly, and tell the human to rotate it — a quietly leaked credential is far worse than an embarrassing correction.

### 7.7 `auth/insufficient-permission` — `roles/datastore.user` does not cover Firebase Auth
Symptom: Firestore reads and writes work perfectly, then any Admin Auth call (`createUser`, `updateUser`, `listUsers`, `verifyIdToken` **with the revocation check**) fails with `auth/insufficient-permission` and a link to the Admin setup docs.

Cause: `roles/datastore.user` grants Firestore only. Identity Toolkit is a separate product with separate permissions, and §1's "exactly one role" advice assumes a Firestore-only server.

Fix: add `roles/firebaseauth.admin` to the same service account, and only if the server genuinely manages credentials:
```bash
gcloud projects add-iam-policy-binding <PROJECT> \
  --member=serviceAccount:<SA_EMAIL> --role=roles/firebaseauth.admin
```

Note the subtlety on token verification: `verifyIdToken(token)` verifies the signature locally against Google's public certs and needs no IAM at all. `verifyIdToken(token, true)` additionally asks the Auth backend whether the token was revoked, and that call does. If you only need verification and not user management, dropping the second argument keeps you on one role — but you lose immediate revocation, so a disabled account stays usable until its token expires.

### 7.8 `gcloud services enable` returns before the API is usable
Symptom: `gcloud services enable firestore.googleapis.com` prints `Operation ... finished successfully`, and the very next command fails with *"Cloud Firestore API has not been used in project ... before or it is disabled"*.

The enable is genuinely asynchronous. The error message says so ("If you enabled this API recently, wait a few minutes to propagate") but it reads like a hard failure and invites re-running the enable, which changes nothing.

Poll for the *effect*, not the enable, and make the loop's success condition something that actually fails when the API is down:
```bash
for i in $(seq 1 12); do
  out=$(gcloud firestore databases list --project=$P --format="value(name)" 2>&1 </dev/null)
  echo "$out" | grep -q "not enabled\|has not been used" || { echo "live"; break; }
  sleep 15
done
```
The `</dev/null` matters: when the API is disabled, `gcloud` offers an interactive "enable and retry? (y/N)" prompt and will hang a non-interactive session waiting for input.

### 7.9 A placeholder in `.firebaserc` breaks every `firebase` command
Symptom: `firebase projects:list` — a command that takes no project — fails with `Error: Invalid project id: REPLACE_WITH_PROJECT_ID. Note: Project id must be all lowercase.`

The CLI validates `.firebaserc` at startup regardless of what the command does. Writing the template's `<PROJECT_ID>` literal, or any uppercase placeholder, bricks the whole CLI until it is removed. Use `{"projects":{}}` until the real id is known (§6.2).

### 7.10 Security rules: helper functions must live inside a `match` block
Symptom: `firebase deploy` fails compilation on rules that look correct.

Functions declared directly under `service cloud.firestore { … }`, after the `match` block, are invalid. They belong **inside** `match /databases/{database}/documents`. The compiler error points at the function, not at the placement, so it reads like a syntax problem in the body.

The deploy compiles rules before uploading, so this is caught safely — but only if you actually deploy. Rules written and never deployed are rules that have never been checked.

### 7.11 Do not conclude "the project does not exist" — check the account first
Symptom: `firebase projects:list` shows twenty projects and none of them is the one you want, so you offer to create it.

Almost always the CLIs are authenticated as a different Google account than the one owning the project. The listing looks completely normal; there is no warning, and a wrong-account listing is indistinguishable from a genuinely missing project. Creating a new project on top of this wastes a project-quota slot, splits configuration across two projects, and is tedious to unwind.

Before proposing creation, always: `gcloud auth list`, `firebase login:list`, and ask the human which account owns it. Note also that `gcloud` and `firebase` maintain **separate** logins — one can be correct while the other is not.

### 7.12 Windows: `/tmp` means different things to Git Bash and Node
Symptom: a shell command writes to `/tmp/token.txt`, a Node script in the same pipeline reads `/tmp/token.txt` and gets ENOENT.

Git Bash maps `/tmp` into its MSYS root; Node resolves it as `C:\tmp`. Anything handed between a shell step and a Node step needs an absolute Windows path, or should stay in one process. Related: Windows `nslookup` exits 0 even for NXDOMAIN, so `if nslookup host >/dev/null; then` is always true — grep the output or use `Resolve-DnsName`, which actually throws.

---

## 8. AI Agent Mandatory Rules

AI agents setting up Firebase/Firestore in a new project MUST:
- **Confirm which account both CLIs are logged into before anything else** (§2 step 0, §7.11). A missing project almost always means the wrong account, not a missing project.
- Follow the checklist in §2 in order — Console-only steps (Auth init, provider enable, Web app registration) cannot be scripted; don't spend time trying.
- **Verify the Console steps happened, from the CLI** (§6.6), rather than trusting an answer or blocking on one. One REST call distinguishes "not initialised", "provider disabled" and "working".
- Use the credential-guard pattern in §4.1 for every Firestore client — a bare `applicationDefault()` call with no guard is a known crash waiting to happen (§7.2).
- Grant the **minimum set of roles that actually work**, and verify afterwards which roles the account ended up with. `roles/datastore.user` for Firestore; add `roles/firebaseauth.admin` only if the server manages Firebase users or checks token revocation (§7.7). Never `Editor`/`Owner`, never reuse a deploy/CI credential for app runtime access.
- **Scope read rules to the caller in any multi-tenant app** (§1.2). `allow read: if request.auth != null` with real user identities is a cross-tenant data leak, not a starting point to harden later.
- Verify functionally (§6.5) before reporting the setup as complete — a 200 response from an "enable API" call is not proof anything actually works. Keep the verification as a committed script.
- Get specific, per-action confirmation before IAM grants or rules deployments (§7.5) — don't treat earlier general authorization as covering these. A second grant needs a second confirmation.
- Keep write-path business logic (ownership, moderation, validation) in the existing service layer — never move it into Firestore security rules under the server-mediated pattern.
- **Clean up after every test** — delete throwaway Firestore documents, Firebase users and database rows, and say that you did.

AI agents MUST NOT:
- Print a raw service-account key's contents into a chat transcript, log, or any non-gitignored file (§7.6).
- **Redact by blacklist when grepping any file that may hold secrets** — whitelist the keys you want instead, or a neighbouring line leaks a credential nobody was thinking about (§7.6). If one does leak, say so at once and tell the human to rotate it.
- Assume `gcloud services enable` succeeding means the *product* is usable — Firestore needs a database created (§2 step 4), the API needs time to propagate (§7.8), and Authentication needs Console init (§7.3) regardless of API enablement.
- **Propose creating a new GCP project** because the target is not in the listing, without first checking the logged-in account (§7.11).
- Write a placeholder project id into `.firebaserc` — it breaks every `firebase` command, including ones that take no project (§7.9).
- Attempt to script Console-only steps via improvised/undocumented REST calls against a live project without explicit, specific sign-off first. (Read-only *verification* calls against documented public endpoints, as in §6.6, are fine and encouraged.)
- Let the client SDK write directly to Firestore under the server-mediated pattern (§1) unless the project has explicitly chosen the custom-token/client-authoritative alternative (§1.1).

---

## 9. Final Principle

> **"Firestore fans out reads in realtime. Your existing service layer still owns every write decision. Security rules are a backstop, not a rulebook. Verify by doing, not by checking a box."**
