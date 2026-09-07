import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { outbox, type OutboxState } from '@/lib/outbox';

/**
 * React binding for the offline outbox. Attaching here (once, from the app
 * shell) is what gives the queue the ability to invalidate caches after a
 * queued write finally lands.
 */
export function useOutbox() {
  const [state, setState] = useState<OutboxState>(() => outbox.snapshot());

  useEffect(() => outbox.subscribe(setState), []);

  const retryNow = useCallback(() => outbox.retryNow(), []);
  const discard = useCallback((id: string) => outbox.discard(id), []);

  return {
    ...state,
    pendingCount: state.entries.filter((entry) => entry.status !== 'conflict').length,
    retryNow,
    discard,
  };
}

/** Mounted once by the app shell. */
export function useOutboxRuntime(): void {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      outbox.attach({
        invalidate: (keys) => {
          keys.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
        },
      }),
    [queryClient],
  );
}

/** Simple online/offline flag for components that only need the boolean. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
