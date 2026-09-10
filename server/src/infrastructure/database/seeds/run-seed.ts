import 'reflect-metadata';
import { closeDatabase, initialiseDatabase } from '../dataSource';
import { env } from '../../../config/env';
import { seedFoundation } from './foundation.seed';

/**
 * `npm run seed -w @school/api`
 *
 * Refuses to run against production. The seed writes invented people and a
 * school into whatever database it is pointed at, which is not something to
 * discover after the fact.
 */
async function main(): Promise<void> {
  if (env.isProduction) {
    throw new Error('The development seed will not run with NODE_ENV=production.');
  }

  const dataSource = await initialiseDatabase();
  try {
    await seedFoundation(dataSource);
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error('[seed] Failed:', error);
  process.exit(1);
});
