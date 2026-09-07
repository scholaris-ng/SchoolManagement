import { CloudOff, RefreshCw } from 'lucide-react';
import { useOutbox } from '@/hooks/use-outbox';
import { Button } from '@/components/ui/button';

/**
 * A persistent, unmissable strip while the connection is down. Teachers keep
 * working — the outbox holds their entries — but they are told plainly that
 * nothing has reached the server yet.
 */
export function OfflineBanner() {
  const { isOnline, entries, retryNow, isFlushing } = useOutbox();
  const queued = entries.filter((entry) => entry.status !== 'conflict').length;

  if (isOnline && queued === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        isOnline
          ? 'flex items-center justify-center gap-3 bg-info-subtle px-4 py-1.5 text-xs text-info no-print'
          : 'flex items-center justify-center gap-3 bg-warning-subtle px-4 py-1.5 text-xs text-warning no-print'
      }
    >
      <CloudOff className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-center">
        {isOnline
          ? `${queued} change${queued === 1 ? '' : 's'} still being sent to the server.`
          : 'You are offline. Your work is saved on this device and will be sent when the connection returns.'}
      </span>
      {isOnline && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={retryNow} loading={isFlushing}>
          <RefreshCw />
          Retry now
        </Button>
      )}
    </div>
  );
}
