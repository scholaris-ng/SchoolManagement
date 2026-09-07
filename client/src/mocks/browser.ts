import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/**
 * Boots the in-browser mock API. Called only from `main.tsx`, and only when
 * `env.useMockApi` is true — which `env.ts` refuses to allow in production.
 */
export async function startMockApi(): Promise<void> {
  await worker.start({
    // Requests we have no handler for (fonts, source maps, Firebase) must keep
    // working; only /api/* is intercepted deliberately by the catch-all above.
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}
