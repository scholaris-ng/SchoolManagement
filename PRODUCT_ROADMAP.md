# Product roadmap

## Product structure

### Foundation layer
- Multi-school tenancy, school-defined levels/classes/subjects/terms/sessions
- User accounts, role/permission management and parent-to-many-children model
- Audit trail, bulk CSV import, branding, document/file storage
- Notification engine with in-app + FCM and provider adapters for SMS/email

### Academic operations
- Admissions pipeline and applicant-to-student conversion
- Student/guardian records
- Attendance with reasons and same-day unexplained-absence alert
- Timetable and shared calendar with conflict checks
- Curriculum objectives, automatic scheme of work and lesson notes/challenges
- CBT question bank, practice/exam mode and objective auto-marking

### Results and reporting
- School-defined grading and assessment structures
- Result entry/moderation/publishing workflow
- Configurable report-card/document templates
- Visual reports, transcripts, verification QR/code and publication notifications
- Ready-made editable teacher/principal comments

### Finance
- Fee catalog, student-specific charges, optional fees, scholarships/discounts
- Invoices, part payment, carry-forward balances and statements
- Payment-provider adapter; reconciliation/webhooks without holding school funds
- Arrears messaging and retention-risk indicators

### Behaviour, safety and engagement
- School-defined behaviour/skill traits and scales
- Ongoing behaviour observations, house points and discipline referrals
- Child pickup authorization/logging
- Parent-teacher messaging, news feed and parent activity history

### Growth and enterprise
- Public school website/profile from school branding/content
- Multi-branch/group dashboard
- Data export, government returns, localization, offline-first mark/attendance entry
- Advanced analytics and staff performance dashboards

## Delivery phases

### Phase 0 — Architecture & UX baseline (1–2 weeks)
Tenant model, security model, design system, environments, CI checks, migrations, logging, audit model, Firebase adapters, feature flags.

### Phase 1 — Sellable MVP (6–8 weeks)
School setup; users/roles; students/guardians; bulk import; attendance; results/grading; report cards; fees/invoices/payments; notifications; parent portal; branding.

Exit criteria: a school can onboard existing records, run one complete term, collect/reconcile fees, publish results and let one parent see all children.

### Phase 2 — Academic differentiation (5–7 weeks)
Curriculum objectives, schemes of work, lesson notes, timetable, shared calendar, CBT, visual student reports, transcripts and verification.

### Phase 3 — Safety & engagement (4–5 weeks)
Behaviour definitions, house points, discipline, pickup safety, messaging/news feed, activity history, admission dashboard.

### Phase 4 — Scale & enterprise (4–6 weeks)
Multi-branch, offline resilience, data export, government reporting, localization, staff performance/retention analytics, operational support tooling.

## MVP priority rule
Build workflows, not isolated features. For example attendance-with-reasons + absence alert should ship together; curriculum objectives + scheme of work + lesson notes should share one underlying model; transcript + verification should ship together.
