# Deployment checklist — Firebase App Hosting + PostgreSQL

1. Create a Firebase project and enable Authentication, Firestore, Storage and Cloud Messaging.
2. Provision PostgreSQL (Cloud SQL for PostgreSQL is the cleanest GCP pairing; any reachable managed PostgreSQL works).
3. Use SSL in production and restrict database network access. Prefer connection pooling/proxy supported by the provider.
4. Configure App Hosting secrets shown in `apphosting.yaml`.
5. Add Firebase Web config values as build-time environment variables for the frontend.
6. Run TypeORM migrations against production before routing traffic to a release. Never enable synchronize.
7. Configure Firebase Auth custom claims only as convenience metadata; keep authoritative school memberships/permissions in PostgreSQL.
8. Create Firestore and Storage security rules. Sensitive school data should normally be mediated by the API or tightly scoped by authenticated school membership.
9. Configure FCM web push/VAPID and a service worker before enabling browser push.
10. Point the App Hosting backend to the repository/root and use `npm run build`; runtime command is `npm run start -w @school/api`.
11. Verify `/api/health/live` and `/api/health/ready` after deployment.
12. Add scheduled backups, PITR where supported, error monitoring, uptime checks and log-based alerts.
