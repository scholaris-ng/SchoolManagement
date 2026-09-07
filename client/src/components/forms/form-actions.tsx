import { useEffect } from 'react';
import { unstable_usePrompt as usePrompt } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';

/**
 * Sticky footer for long forms plus the unsaved-changes guard.
 *
 * Losing half an hour of typed student records to an accidental back-navigation
 * is a real failure mode on this kind of product, so the guard is standard.
 */
export function FormActions({
  onCancel,
  submitLabel = 'Save changes',
  cancelLabel = 'Cancel',
  loading,
  disabled,
  dirty,
  extra,
  className,
}: {
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  dirty?: boolean;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-b-lg',
        className,
      )}
    >
      {extra && <div className="mr-auto text-sm text-muted-foreground">{extra}</div>}
      {dirty && (
        <p className="mr-auto text-xs text-muted-foreground sm:mr-4" role="status">
          You have unsaved changes
        </p>
      )}
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      )}
      <Button type="submit" loading={loading} disabled={disabled} loadingLabel="Saving…">
        {submitLabel}
      </Button>
    </div>
  );
}

/** Blocks in-app navigation and browser unload while a form is dirty. */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  usePrompt({
    when,
    message: 'You have unsaved changes. Leave this page and lose them?',
  });

  useEffect(() => {
    if (!when) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);

  return null;
}

/**
 * Surfaces a submission failure at the top of the form. Field-level messages
 * are rendered by the fields themselves; this covers everything else.
 */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;

  if (isApiError(error) && error.isVersionConflict) {
    return (
      <Alert tone="warning" title="Someone else edited this record">
        Your copy is out of date. Reload the page to see their changes, then apply yours again —
        saving now would overwrite their work.
      </Alert>
    );
  }

  const message = isApiError(error)
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Something went wrong. Please try again.';

  const details = isApiError(error) ? error.details : [];

  return (
    <Alert tone="danger" title="Could not save">
      <p>{message}</p>
      {details.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          {details.map((detail, index) => (
            <li key={index}>
              {detail.field ? <strong>{detail.field}: </strong> : null}
              {detail.message}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
