import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast, type ToastMessage, type ToastVariant } from '@/lib/toast-bus';

/** The toast stack. One instance sits at the root of the app. */

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
