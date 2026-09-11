import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
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
  'data-cy': dataCy = 'form',
}: {
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  dirty?: boolean;
  extra?: React.ReactNode;
  className?: string;
  /** Cypress hook. Yields `<cy>-submit` and `<cy>-cancel`; defaults to `form`. */
  'data-cy'?: string;
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
        <Button
          type="button"
          variant="outline"
          data-cy={`${dataCy}-cancel`}
          onClick={onCancel}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        type="submit"
        data-cy={`${dataCy}-submit`}
        loading={loading}
        disabled={disabled}
        loadingLabel="Saving…"
      >
        {submitLabel}
      </Button>
    </div>
  );
}

/**
 * Asks before a dirty form is navigated away from, in the app dialog.
 *
 * It guards navigation inside the app only. Closing the tab or hitting the
 * browser's own reload is deliberately not caught: the only way to intercept
 * that is the `beforeunload` event, and what it puts on screen is the
 * browser's own box, which ignores the message given to it and cannot be
 * styled, translated or tested. Section 19 bans dialogs like that, so the
 * work is protected where this application can do it properly and left alone
 * where it cannot.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(when);

  /*
    A save landing while the question is still on screen makes it moot: there
    is nothing left to lose, so drop the block rather than leave a dead dialog
    sitting over the page.
  */
  useEffect(() => {
    if (blocker.state === 'blocked' && !when) blocker.reset();
  }, [blocker, when]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
      title="Leave without saving?"
      description="The changes you made on this page have not been saved. Leaving now loses them."
      confirmLabel="Leave page"
      cancelLabel="Stay on page"
      tone="danger"
      onConfirm={() => {
        if (blocker.state !== 'blocked') return;
        /*
          A back-button navigation reverts the history entry while the question
          is still open, so hand the proceed to the next tick and let that
          settle first.
        */
        const { proceed } = blocker;
        setTimeout(proceed, 0);
      }}
      data-cy="unsaved-changes-dialog"
    />
  );
}

/**
 * Surfaces a submission failure at the top of the form. Field-level messages
 * are rendered by the fields themselves; this covers everything else.
 */
export function FormError({
  error,
  'data-cy': dataCy = 'form-error',
}: {
  error: unknown;
  'data-cy'?: string;
}) {
  if (!error) return null;

  if (isApiError(error) && error.isVersionConflict) {
    return (
      <Alert tone="warning" title="Someone else edited this record" data-cy={dataCy}>
        Your copy is out of date. Reload the page to see their changes, then apply yours again —
        saving now would overwrite their work.
      </Alert>
    );
  }

  const details = isApiError(error) ? error.details : [];

  /*
    A validation failure is the one case where the reader is better served by
    less. The fields carry their own messages, so repeating all of them here
    produces a wall of text listing internal field names — "addressLine1: String
    must contain at least 1 character(s)" — which reads as a crash rather than
    as three boxes needing attention. Point at the form and let the form speak.

    Anything with no field to attach to still has to be shown here, because
    otherwise it would appear nowhere at all.
  */
  if (isApiError(error) && error.isValidation) {
    /*
      A field-level message has a path that points inside the payload, such as
      `body.phone`. One that stops at the root — `body` on its own, which is
      what a whole-object complaint produces — belongs to no input on the
      screen, so it must be printed here or it would be shown nowhere.
    */
    const unattached = details.filter((detail) => !detail.path?.includes('.'));
    const attached = details.length - unattached.length;

    return (
      <Alert tone="danger" title="Could not save" data-cy={dataCy}>
        <p>
          {attached === 0
            ? 'Please check the details you entered and try again.'
            : attached === 1
              ? 'One field needs your attention. It is marked below.'
              : `${attached} fields need your attention. They are marked below.`}
        </p>
        {unattached.length > 0 && (
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {unattached.map((detail, index) => (
              <li key={index}>{detail.message}</li>
            ))}
          </ul>
        )}
      </Alert>
    );
  }

  const message = isApiError(error)
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Something went wrong. Please try again.';

  return (
    <Alert tone="danger" title="Could not save" data-cy={dataCy}>
      <p>{message}</p>
    </Alert>
  );
}
