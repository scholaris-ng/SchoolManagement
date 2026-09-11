/**
 * Deletes sign-in accounts from Firebase Authentication, keeping named ones.
 *
 * Why this exists: credentials live in Firebase, not in our database, so
 * clearing the `staff` and `users` tables leaves the accounts behind. The next
 * import of those people then fails with "an account with that email address
 * already exists" against rows that are nowhere in our own data.
 *
 * This deletes real credentials and cannot be undone — a deleted account cannot
 * sign in, and its `firebase_uid` on any surviving row points at nothing. It is
 * therefore deliberately awkward to run:
 *
 *   1. Dry run first. It lists exactly what would go and prints a token.
 *        npx tsx scripts/purge-firebase-users.ts --keep me@school.com
 *   2. Only then, repeat with the token it gave you.
 *        npx tsx scripts/purge-firebase-users.ts --keep me@school.com --confirm 34
 *
 * Platform administrators are always kept, whether or not you list them —
 * deleting your own way back in is not a mistake worth allowing.
 */
import { AppDataSource, closeDatabase, initialiseDatabase } from '../src/infrastructure/database/dataSource';
import { getFirebaseAuth, isFirebaseConfigured } from '../src/infrastructure/firebase/firebaseAdmin';

interface Account {
  uid: string;
  email: string;
}

function parseArgs(argv: string[]): { keep: Set<string>; confirm: number | null; keepNone: boolean } {
  const keep = new Set<string>();
  let confirm: number | null = null;
  let keepNone = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--keep') {
      const value = argv[i + 1];
      i += 1;
      if (!value || value.startsWith('--')) continue;
      for (const email of value.split(',')) {
        const trimmed = email.trim().toLowerCase();
        if (trimmed) keep.add(trimmed);
      }
    } else if (arg === '--confirm') {
      const value = argv[i + 1];
      i += 1;
      const parsed = Number(value);
      confirm = Number.isInteger(parsed) ? parsed : NaN;
    } else if (arg === '--keep-none') {
      keepNone = true;
    }
  }

  return { keep, confirm, keepNone };
}

/** Every account in the project, a page at a time. */
async function listAllAccounts(): Promise<Account[]> {
  const auth = getFirebaseAuth();
  const accounts: Account[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      if (user.email) accounts.push({ uid: user.uid, email: user.email.toLowerCase() });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return accounts;
}

/**
 * Addresses that must survive regardless of what was asked for.
 *
 * Read from our own database rather than taken on trust: whoever runs this is
 * usually trying to clean up test data, and locking themselves out of the
 * platform in the process is not a recoverable mistake.
 */
async function protectedEmails(): Promise<Set<string>> {
  const rows: { email: string }[] = await AppDataSource.query(
    `SELECT email FROM users WHERE is_platform_admin = TRUE AND deleted_at IS NULL`,
  );
  return new Set(rows.map((row) => row.email.toLowerCase()));
}

async function main(): Promise<void> {
  const { keep, confirm, keepNone } = parseArgs(process.argv.slice(2));

  if (!isFirebaseConfigured()) {
    console.error('Firebase is not configured for this environment. Nothing to do.');
    process.exitCode = 1;
    return;
  }

  if (keep.size === 0 && !keepNone) {
    console.error(
      'Refusing to run without --keep. Name the addresses to preserve, e.g.\n' +
        '  --keep me@school.com,bursar@school.com\n' +
        'If you really mean to delete every account, pass --keep-none.',
    );
    process.exitCode = 1;
    return;
  }

  await initialiseDatabase();

  const protectedAdmins = await protectedEmails();
  for (const email of protectedAdmins) keep.add(email);

  const accounts = await listAllAccounts();
  const doomed = accounts.filter((account) => !keep.has(account.email));

  console.info(`Accounts in the project : ${accounts.length}`);
  console.info(`Kept                    : ${accounts.length - doomed.length}`);
  console.info(`To delete               : ${doomed.length}`);
  if (protectedAdmins.size > 0) {
    console.info(`Platform admins kept    : ${[...protectedAdmins].join(', ')}`);
  }

  if (doomed.length === 0) {
    console.info('\nNothing matches. No changes made.');
    await closeDatabase();
    return;
  }

  console.info('\nWould delete:');
  for (const account of doomed.slice(0, 40)) console.info(`  ${account.email}`);
  if (doomed.length > 40) console.info(`  … and ${doomed.length - 40} more`);

  // How many of these still have a row here. Deleting the credential of a live
  // user leaves them in the roster unable to sign in, which is worth knowing
  // before rather than after.
  const stillReferenced: { n: number }[] = await AppDataSource.query(
    `SELECT COUNT(*)::int AS n FROM users
      WHERE deleted_at IS NULL AND email = ANY($1::text[])`,
    [doomed.map((account) => account.email)],
  );
  if (stillReferenced[0].n > 0) {
    console.warn(
      `\nWARNING: ${stillReferenced[0].n} of these still have a user row in this database.\n` +
        'Deleting their credential leaves them in the school unable to sign in.',
    );
  }

  if (confirm === null) {
    console.info(
      `\nDry run — nothing was deleted.\nRe-run with --confirm ${doomed.length} to delete these ${doomed.length} account(s).`,
    );
    await closeDatabase();
    return;
  }

  if (confirm !== doomed.length) {
    console.error(
      `\nRefusing to delete: --confirm ${confirm} does not match the ${doomed.length} account(s) found.\n` +
        'The number must match exactly, so a list that changed since the dry run stops rather than surprises you.',
    );
    process.exitCode = 1;
    await closeDatabase();
    return;
  }

  const auth = getFirebaseAuth();
  let deleted = 0;
  let failed = 0;

  // `deleteUsers` takes at most 1000 identifiers per call.
  for (let start = 0; start < doomed.length; start += 1000) {
    const batch = doomed.slice(start, start + 1000);
    const result = await auth.deleteUsers(batch.map((account) => account.uid));
    deleted += result.successCount;
    failed += result.failureCount;
    for (const error of result.errors) {
      console.error(`  failed: ${batch[error.index]?.email} — ${error.error.message}`);
    }
  }

  console.info(`\nDeleted ${deleted} account(s).${failed > 0 ? ` ${failed} failed.` : ''}`);
  await closeDatabase();
}

main().catch(async (error) => {
  console.error('Purge failed:', error);
  process.exitCode = 1;
  await closeDatabase().catch(() => undefined);
});
