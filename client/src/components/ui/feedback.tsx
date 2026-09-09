import { useEffect, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Inbox,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import { toast, type ToastMessage, type ToastVariant } from '@/lib/toast-bus';
import { Button } from './button';
import { Skeleton } from './primitives';

/* -------------------------------------------------------------------------- */
/* Toasts                                                                      */
/* -------------------------------------------------------------------------- */

const toastStyles: Record<ToastVariant, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'border-success/30 bg-success-subtle text-success' },
  error: { icon: AlertCircle, className: 'border-danger/30 bg-danger-subtle text-danger' },
  warning: { icon: TriangleAlert, className: 'border-warning/30 bg-warning-subtle text-warning' },
  info: { icon: Info, className: 'border-info/30 bg-info-subtle text-info' },
};

export function Toaster() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // Wrapped rather than returned directly: `subscribe` hands back the Set's
    // own `delete`, and React requires a cleanup that returns nothing.
    const unsubscribe = toast.subscribe((message) => {
      setMessages((current) => [...current.slice(-3), message]);
      if (message.durationMs > 0) {
        setTimeout(
          () => setMessages((current) => current.filter((m) => m.id !== message.id)),
          message.durationMs,
        );
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const dismiss = (id: string) => setMessages((current) => current.filter((m) => m.id !== id));

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
      role="region"
      aria-label="Notifications"
    >
      {messages.map((message) => {
        const { icon: Icon, className } = toastStyles[message.variant];
        return (
          <div
            key={message.id}
            role="status"
            aria-live={message.variant === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3 shadow-popover animate-slide-up',
              className,
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{message.title}</p>
              {message.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{message.description}</p>
              )}
              {message.action && (
                <button
                  type="button"
                  data-cy={`toast-action-${message.id}`}
                  onClick={() => {
                    message.action?.onClick();
                    dismiss(message.id);
                  }}
                  className="mt-1.5 text-xs font-semibold underline underline-offset-2"
                >
                  {message.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              data-cy={`toast-dismiss-${message.id}`}
              onClick={() => dismiss(message.id)}
              className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Alert                                                                       */
/* -------------------------------------------------------------------------- */

export interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  'data-cy'?: string;
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
  icon,
  'data-cy': dataCy,
}: AlertProps) {
  const tones = {
    info: { wrapper: 'border-info/30 bg-info-subtle', text: 'text-info', Icon: Info },
    success: { wrapper: 'border-success/30 bg-success-subtle', text: 'text-success', Icon: CheckCircle2 },
    warning: { wrapper: 'border-warning/30 bg-warning-subtle', text: 'text-warning', Icon: TriangleAlert },
    danger: { wrapper: 'border-danger/30 bg-danger-subtle', text: 'text-danger', Icon: ShieldAlert },
  }[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      data-cy={dataCy}
      className={cn('flex items-start gap-3 rounded-lg border p-3.5', tones.wrapper, className)}
    >
      <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', tones.text)} aria-hidden="true">
        {icon ?? <tones.Icon />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className={cn('text-muted-foreground', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty / error / loading states                                              */
/* -------------------------------------------------------------------------- */

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
  /** The state carries it; the retry button gets `<cy>-retry`. */
  'data-cy'?: string;
}

export function ErrorState({
  error,
  onRetry,
  title,
  className,
  compact,
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
        onRetry && !forbidden ? (
          <Button
            variant="outline"
            size="sm"
            data-cy={dataCy ? `${dataCy}-retry` : undefined}
            onClick={onRetry}
          >
            <RefreshCw />
            Try again
          </Button>
        ) : undefined
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

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                     */
/* -------------------------------------------------------------------------- */

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-popover animate-in dark:bg-slate-700"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-slate-900 dark:fill-slate-700" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
