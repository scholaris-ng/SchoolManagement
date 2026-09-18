/**
 * Changes a person's sign-in email in Firebase Authentication and in our own
 * database, together.
 *
 * Why this exists: the Firebase console cannot edit an email, and the address is
 * held in three places that must agree — the Firebase account, the `users` row,
 * and any `staff` rows linked to that user. Changing only Firebase leaves the
 * roster showing an address the person can no longer sign in with.
 *
 * The Firebase UID does not change, and sessions are matched on it, so the
 * person keeps their memberships and history.
 *
 *   1. Dry run first. It shows what would change.
 *        npx tsx scripts/change-user-email.ts --from old@school.com --to new@school.com
 *   2. Then repeat with --confirm.
 *        npx tsx scripts/change-user-email.ts --from old@school.com --to new@school.com --confirm
 *
 * Firebase is updated first and the database second, inside a transaction. If
 * the database step fails, the Firebase change is put back so the two never
 * disagree. Existing sessions are revoked, so the person signs in again with the
 * new address.
 *
 * The new address is not proved to belong to the person: Firebase's
 * `emailVerified` is left as it was. Check the address before running this.
 */
import { AppDataSource, closeDatabase, initialiseDatabase } from '../src/infrastructure/database/dataSource';
import { getFirebaseAuth, isFirebaseConfigured } from '../src/infrastructure/firebase/firebaseAdmin';

function parseArgs(argv: string[]): { from: string | null; to: string | null; confirm: boolean } {
  let from: string | null = null;
  let to: string | null = null;
  let confirm = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
      from = argv[i + 1]?.trim().toLowerCase() || null;
      i += 1;
    } else if (arg === '--to') {
      to = argv[i + 1]?.trim().toLowerCase() || null;
      i += 1;
    } else if (arg === '--confirm') {
      confirm = true;
    }
  }

  return { from, to, confirm };
}

function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const { from, to, confirm } = parseArgs(process.argv.slice(2));

  if (!from || !to) {
    fail('Usage: --from old@example.com --to new@example.com [--confirm]');
    return;
  }
  if (from === to) {
    fail('The old and new addresses are the same. Nothing to do.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    fail(`"${to}" does not look like an email address.`);
    return;
  }
  if (!isFirebaseConfigured()) {
    fail('Firebase is not configured for this environment. Nothing to do.');
    return;
  }

  await initialiseDatabase();
  const auth = getFirebaseAuth();

  try {
    const users: { id: string; firebase_uid: string }[] = await AppDataSource.query(
      `SELECT id, firebase_uid FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [from],
    );
    if (users.length !== 1) {
      fail(`Expected one user with email ${from} in this database, found ${users.length}.`);
      return;
    }
    const user = users[0];

    // Refuse before touching anything if the target is already someone's.
    const taken: { n: number }[] = await AppDataSource.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE email = $1`,
      [to],
    );
    if (taken[0].n > 0) {
      fail(`A user row with email ${to} already exists (soft-deleted rows count). Resolve that first.`);
      return;
    }
    const existingFirebase = await auth.getUserByEmail(to).catch(() => null);
    if (existingFirebase) {
      fail(`A Firebase account with email ${to} already exists (uid ${existingFirebase.uid}).`);
      return;
    }

    const firebaseUser = await auth.getUser(user.firebase_uid).catch(() => null);
    if (!firebaseUser) {
      fail(`Firebase has no account for uid ${user.firebase_uid}. Nothing was changed.`);
      return;
    }
    if (firebaseUser.email?.toLowerCase() !== from) {
      fail(
        `Firebase has ${firebaseUser.email ?? '(no email)'} for this account, not ${from}. ` +
          'The two have already drifted apart — sort that out by hand first.',
      );
      return;
    }

    const staff: { n: number }[] = await AppDataSource.query(
      `SELECT COUNT(*)::int AS n FROM staff WHERE user_id = $1 AND deleted_at IS NULL`,
      [user.id],
    );

    console.info(`Firebase account : ${firebaseUser.uid}`);
    console.info(`Change           : ${from}  →  ${to}`);
    console.info(`Rows to update   : 1 user, ${staff[0].n} staff`);

    if (!confirm) {
      console.info('\nDry run — nothing was changed.\nRe-run with --confirm to apply.');
      return;
    }

    await auth.updateUser(firebaseUser.uid, { email: to });

    try {
      await AppDataSource.transaction(async (manager) => {
        await manager.query(`UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2`, [to, user.id]);
        await manager.query(
          `UPDATE staff SET email = $1, updated_at = NOW() WHERE user_id = $2 AND deleted_at IS NULL`,
          [to, user.id],
        );
      });
    } catch (error) {
      await auth.updateUser(firebaseUser.uid, { email: from });
      console.error('Database update failed; Firebase email has been put back.');
      throw error;
    }

    await auth.revokeRefreshTokens(firebaseUser.uid);
    console.info(`\nDone. ${from} is now ${to}. Existing sessions were revoked.`);
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error('Email change failed:', error);
  process.exitCode = 1;
  return closeDatabase().catch(() => undefined);
});
