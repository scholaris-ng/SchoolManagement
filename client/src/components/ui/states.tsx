import { AlertCircle, Inbox, Loader2, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import { Button } from './button';
import { Skeleton } from './primitives';

/** What a screen shows when it has nothing to show: empty, failed or loading. */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
  'data-cy'?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
  'data-cy': dataCy,
}: EmptyStateProps) {
  return (
    <div
      data-cy={dataCy}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span
        className={cn(
          'grid place-items-center rounded-full bg-muted text-muted-foreground',
          compact ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-6',
        )}
        aria-hidden="true"
      >
        {icon ?? <Inbox />}
      </span>
      <div className="max-w-sm">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
  /** Extra action shown alongside "Try again", e.g. a link to fix the root cause. */
  action?: React.ReactNode;
  /** The state carries it; the retry button gets `<cy>-retry`. */
  'data-cy'?: string;
}

export function ErrorState({
  error,
  onRetry,
  title,
  className,
  compact,
  action,
  'data-cy': dataCy,
}: ErrorStateProps) {
  const offline = isApiError(error) && error.isOffline;
  const forbidden = isApiError(error) && error.isForbidden;

  const heading =
    title ??
    (offline
      ? 'You are offline'
      : forbidden
        ? 'You do not have access to this'
        : 'We could not load this');

  const description = offline
    ? 'Check your connection. We will try again automatically when it returns.'
    : forbidden
      ? 'Ask a school administrator if you believe you should be able to see it.'
      : isApiError(error)
        ? error.message
        : 'An unexpected error occurred.';

  return (
    <EmptyState
      className={className}
      compact={compact}
      data-cy={dataCy}
      icon={offline ? <WifiOff /> : forbidden ? <ShieldAlert /> : <AlertCircle />}
      title={heading}
      description={description}
      action={
        (action || (onRetry && !forbidden)) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action}
            {onRetry && !forbidden && (
              <Button
                variant="outline"
                size="sm"
                data-cy={dataCy ? `${dataCy}-retry` : undefined}
                onClick={onRetry}
              >
                <RefreshCw />
                Try again
              </Button>
            )}
          </div>
        )
      }
    />
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span role="status">{label}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn('h-4 flex-1', colIndex === 0 && 'max-w-[14rem]')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-5', className)} aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-40" />
    </div>
  );
}
