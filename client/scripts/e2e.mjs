/**
 * Runs the E2E suite: start the app in e2e mode, wait for it, run Cypress,
 * shut the app down again. Exits with Cypress's own exit code.
 *
 * This exists instead of `start-server-and-test` because that package tears the
 * server down through `tree-kill`, which shells out to `wmic.exe` — removed
 * from current Windows 11 builds, so the whole run dies with
 * `spawn wmic.exe ENOENT` before Cypress reports anything. Killing by PID with
 * `taskkill /T` (or a process-group signal elsewhere) has no such dependency.
 *
 * Usage: node scripts/e2e.mjs [--open] [-- <extra cypress args>]
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const URL = 'http://localhost:5173';
const READY_TIMEOUT_MS = 90_000;
const isWindows = process.platform === 'win32';

const argv = process.argv.slice(2);
const open = argv.includes('--open');
const passthrough = argv.filter((arg) => arg !== '--open');

/** Spawns an npm/npx binary in a way that works on Windows too. */
function run(command, args, options = {}) {
  return spawn(command, args, { stdio: 'inherit', shell: isWindows, ...options });
}

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(URL, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      /* Not listening yet. */
    }
    await delay(500);
  }
  throw new Error(`The e2e dev server did not answer on ${URL} within 90s.`);
}

function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (isWindows) {
    // /T takes the whole tree (vite spawns workers); /F because the dev server
    // ignores a polite request once its stdio is detached.
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    process.kill(-child.pid, 'SIGTERM');
  }
}

const server = run('npm', ['run', 'dev:e2e'], {
  detached: !isWindows,
});

let exitCode = 1;
try {
  await waitForServer();

  const cypress = run('npx', [
    'cypress',
    open ? 'open' : 'run',
    '--e2e',
    ...passthrough,
  ]);

  exitCode = await new Promise((resolve) => {
    cypress.on('close', (code) => resolve(code ?? 1));
    cypress.on('error', () => resolve(1));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  stop(server);
}

process.exit(exitCode);
