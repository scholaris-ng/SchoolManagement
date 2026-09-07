import * as Popover from '@radix-ui/react-popover';
import { AlertOctagon, CheckCircle2, CloudOff, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import { useOutbox } from '@/hooks/use-outbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';

/**
 * Honest synchronisation status (spec section 39).
 *
 * The one thing this must never do is imply that something reached the server
 * when it did not. Queued work is labelled "waiting to sync", failures are
 * named, and a conflict is escalated rather than silently resolved.
 */
export function SyncIndicator({ className }: { className?: string }) {
  const { entries, isOnline, isFlushing, retryNow, discard } = useOutbox();

  const conflicts = entries.filter((entry) => entry.status === 'conflict');
  const failed = entries.filter((entry) => entry.status === 'failed');
  const pending = entries.filter((entry) => entry.status === 'pending' || entry.status === 'sending');

  const state = !isOnline
    ? 'offline'
    : conflicts.length > 0
      ? 'conflict'
      : failed.length > 0
        ? 'failed'
        : pending.length > 0
          ? 'pending'
          : 'synced';

  const config = {
    offline: { icon: CloudOff, label: 'Offline', tone: 'warning' as const },
    conflict: { icon: AlertOctagon, label: 'Conflict', tone: 'danger' as const },
    failed: { icon: AlertOctagon, label: 'Sync failed', tone: 'danger' as const },
    pending: { icon: UploadCloud, label: `${pending.length} to sync`, tone: 'info' as const },
    synced: { icon: CheckCircle2, label: 'All saved', tone: 'success' as const },
  }[state];

  // Nothing to say when everything is saved and the connection is fine.
  if (state === 'synced' && entries.length === 0) {
    return (
      <span className={cn('hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex', className)}>
        <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
        <span>All changes saved</span>
      </span>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent',
            className,
          )}
          aria-label={`Synchronisation status: ${config.label}`}
        >
          <config.icon
            className={cn(
              'size-3.5',
              config.tone === 'danger' && 'text-danger',
              config.tone === 'warning' && 'text-warning',
              config.tone === 'info' && 'text-info',
              config.tone === 'success' && 'text-success',
              isFlushing && 'animate-pulse',
            )}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">{config.label}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-0 shadow-popover animate-in"
        >
          <div className="flex items-center justify-between border-b border-border p-3">
            <div>
              <p className="text-sm font-semibold">Synchronisation</p>
              <p className="text-xs text-muted-foreground">
                {isOnline ? 'Connected' : 'No connection — work is saved on this device'}
              </p>
            </div>
            {(failed.length > 0 || pending.length > 0) && isOnline && (
              <Button variant="outline" size="sm" onClick={retryNow} loading={isFlushing}>
                <RefreshCw />
                Retry
              </Button>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Everything you have entered has reached the server.
            </p>
          ) : (
            <ul className="scrollbar-thin max-h-80 divide-y divide-border overflow-y-auto">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Queued {formatRelative(new Date(entry.createdAt).toISOString())}
                      {entry.attempts > 0 && ` · ${entry.attempts} attempt${entry.attempts > 1 ? 's' : ''}`}
                    </p>
                    {entry.lastError && (
                      <p className="mt-1 text-xs text-danger">{entry.lastError}</p>
                    )}
                    {entry.status === 'conflict' && (
                      <p className="mt-1 text-xs text-danger">
                        Someone else changed this record first. Reopen the page to see their version
                        before saving yours.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge
                      tone={
                        entry.status === 'conflict' || entry.status === 'failed'
                          ? 'danger'
                          : entry.status === 'sending'
                            ? 'info'
                            : 'warning'
                      }
                    >
                      {entry.status === 'sending' ? 'Sending' : entry.status === 'pending' ? 'Waiting' : entry.status === 'failed' ? 'Failed' : 'Conflict'}
                    </Badge>
                    {(entry.status === 'failed' || entry.status === 'conflict') && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => discard(entry.id)}
                        aria-label={`Discard ${entry.label}`}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
