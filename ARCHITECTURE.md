# Architecture

## Data ownership

**PostgreSQL — source of truth**
Students, guardians, enrolments, academic structure, attendance, assessments, results, fees, invoices, payments, admission state, behaviour, permissions, audit metadata.

**Firestore — realtime collaboration/read models**
Conversation threads/messages, notification inbox projection, presence-like transient state. Avoid duplicating authoritative financial/result state.

**Firebase Storage — binary objects**
Student documents, admission attachments, school branding assets, report exports. Persist object path, size, mime type, schoolId and uploader in PostgreSQL.

**FCM — transport only**
Push delivery. Persist notification intent and delivery state in the application database or notification projection.

## Layering

`domain` — entities/value rules/interfaces without Express, TypeORM or Firebase.

`application` — use cases and orchestration. Depends on domain interfaces.

`infrastructure` — TypeORM repositories, Firebase adapters, logging, external gateways.

`interfaces/http` — Express routes/controllers/middleware and DTO validation.

## Repository pattern

Repositories expose domain-oriented methods rather than query-builder details. Complex reporting queries may use dedicated read repositories/read models instead of forcing everything through CRUD repositories.

## Extensibility patterns

- `NotificationChannel` adapter: FCM/SMS/email/WhatsApp.
- `PaymentGateway` adapter: Paystack/Flutterwave/etc.
- `FileStorage` adapter: Firebase Storage today, alternative later.
- `DocumentRenderer` adapter: HTML/PDF renderer.
- `IdentityProvider` adapter: Firebase Auth or another IdP.
- Domain events/outbox for post-transaction notification and projection work.

## Security baseline

- Firebase ID token verified at API boundary.
- App authorization is server-side RBAC/permissions scoped by `schoolId`.
- Never trust a client-supplied schoolId without checking membership.
- Audit result/fee/permission changes.
- Use signed or server-mediated file access for sensitive student files.
- Secrets live in App Hosting/Secret Manager, not Vite environment variables.
