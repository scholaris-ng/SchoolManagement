import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { ErrorState } from '@/components/ui/feedback';

/**
 * A new deploy replaces every hashed asset file. A tab left open across one —
 * or a bookmark cached from before it — can then ask for a route's chunk
 * under a filename that no longer exists on the server. That surfaces as a
 * `TypeError` thrown by the dynamic `import()` behind `React.lazy`, which no
 * route here catches on its own, so without this boundary it reaches React
 * Router's generic fallback ("Unexpected Application Error!"). A full reload
 * fetches the current `index.html` and its current asset manifest, which
 * resolves it — so this tries that once per error before showing anything a
 * person has to act on. The cooldown key stops a genuinely broken deploy from
 * reload-looping the tab forever.
 */
const RELOAD_KEY = 'scholaris:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(
    message,
  );
}

export function AppErrorBoundary() {
  const error = useRouteError();
  const stale = isStaleChunkError(error);
  const lastAttempt = stale ? Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) : 0;
  const justRetried = stale && Date.now() - lastAttempt < RELOAD_COOLDOWN_MS;

  useEffect(() => {
    if (!stale || justRetried) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
    // Only ever act on the error this boundary mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (stale && !justRetried) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <ErrorState
        error={error}
        title={stale ? 'This page needs a refresh' : 'Something went wrong'}
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
