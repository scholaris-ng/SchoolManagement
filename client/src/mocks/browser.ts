import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

const startOptions = {
  // Requests we have no handler for (fonts, source maps, Firebase) must keep
  // working; only /api/* is intercepted deliberately by the catch-all above.
  onUnhandledRequest: 'bypass' as const,
  quiet: true,
  serviceWorker: { url: '/mockServiceWorker.js' },
};

/**
 * Browsers terminate an idle service worker to free memory. It respawns on
 * the next request, but its in-memory record of which page "activated" mocking
 * is gone, so that request falls through to the real network instead of being
 * mocked — the app then shows a generic request-failed error until reloaded.
 * MSW pings the worker every few seconds to stall this, but that ping is a
 * timer, and timers stall too once the tab is backgrounded or the machine
 * sleeps for long enough. Redoing the start handshake whenever the tab is
 * looked at again catches that before the user notices.
 */
function reactivateOnReturn(): void {
  if (typeof document === 'undefined') return;
  let reactivating = false;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || reactivating) return;
    reactivating = true;
    worker.stop();
    worker
      .start(startOptions)
      .catch((cause) => {
        console.error('[mock-api] Failed to reactivate the mock API.', cause);
      })
      .finally(() => {
        reactivating = false;
      });
  });
}

/**
 * Boots the in-browser mock API. Called only from `main.tsx`, and only when
 * `env.useMockApi` is true — which `env.ts` refuses to allow in production.
 */
export async function startMockApi(): Promise<void> {
  await worker.start(startOptions);
  reactivateOnReturn();
}
