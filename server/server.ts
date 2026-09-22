import 'reflect-metadata';
import type { Server } from 'node:http';
import { createApp } from './src/app';
import { env } from './src/config/env';
import { closeDatabase, initialiseDatabase } from './src/infrastructure/database/dataSource';
import {
  failRunningImports,
  reapAbandonedImports,
} from './src/modules/imports/services/imports.service';
import { isFirebaseConfigured } from './src/infrastructure/firebase/firebaseAdmin';
import { buildScheduler } from './src/infrastructure/scheduler/jobs';
import type { Scheduler } from './src/infrastructure/scheduler/scheduler';

/**
 * Entrypoint. Run through `tsx`, never plain `node` — the require graph is
 * TypeScript throughout (`server_arch.md` section 1.1).
 */
async function main(): Promise<void> {
  await initialiseDatabase();
  console.info('[api] Database connected.');

  // An import runs in this process, so one that was in flight when the last
  // process stopped is never coming back. Left alone its progress bar would
  // sit part way for ever.
  const abandoned = await reapAbandonedImports();
  if (abandoned > 0) {
    console.warn(`[api] Marked ${abandoned} unfinished import(s) as failed.`);
  }

  if (!isFirebaseConfigured()) {
    const note = env.devAuthEnabled
      ? 'development tokens are enabled, so sign-in still works'
      : 'sign-in will fail until it is configured';
    console.warn(`[api] Firebase Admin is not configured — ${note}.`);
  }

  if (!env.sms.kudisms.configured) {
    console.warn('[api] KudiSMS is not configured — birthday texts and other SMS will be logged as failed, not sent.');
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.info(`[api] Listening on http://localhost:${env.port}${env.apiPrefix}`);
  });

  // Background jobs (birthday greetings, and whatever joins them) run in this
  // process. Off under test, and on exactly one instance in production.
  let scheduler: Scheduler | null = null;
  if (env.scheduler.enabled) {
    scheduler = buildScheduler();
    scheduler.start();
  } else {
    console.info('[api] Scheduler is disabled; scheduled jobs will not run in this process.');
  }

  installShutdownHandlers(server, scheduler);
}

/**
 * Stop taking new connections, let in-flight requests finish, then close the
 * pool. A hard exit mid-request would leave a half-applied write behind.
 */
function installShutdownHandlers(server: Server, scheduler: Scheduler | null): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[api] ${signal} received, shutting down.`);

    // No new job ticks once we are on the way out; one already running either
    // finishes or is cut off with the pool, and its dedupe keys make both safe.
    scheduler?.stop();

    const timer = setTimeout(() => {
      console.error('[api] Shutdown timed out, exiting.');
      process.exit(1);
    }, 10_000);
    timer.unref();

    server.close(async () => {
      // `server.close` waits for HTTP connections, and a bulk import is not
      // one — it would be cut off mid-run with the job still reading
      // "importing". Say so before the pool goes.
      await failRunningImports();
      await closeDatabase();
      clearTimeout(timer);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('[api] Unhandled rejection:', reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('[api] Uncaught exception:', error);
    shutdown('uncaughtException');
  });
}

main().catch((error) => {
  console.error('[api] Failed to start:', error);
  process.exit(1);
});
