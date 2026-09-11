import { useId } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/primitives';

/**
 * The chrome every form field shares.
 *
 * `FieldShell` wires up label/description/error ids so assistive technology
 * reads the whole field, not just the input — `aria-describedby` and
 * `aria-invalid` are handled here so no screen forgets them. `BaseFieldProps`
 * is the prop contract each field type extends.
 */

export interface FieldShellProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  description?: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}

export function FieldShell({
  label,
  required,
  description,
  error,
  hint,
  className,
  children,
}: FieldShellProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-danger">
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  description?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /**
   * Cypress hook. Defaults to `field-<name>` — the form path is already unique
   * within a form, so every field is addressable without each caller inventing
   * an id. Pass this only where two forms with the same field name are on
   * screen at once.
   */
  'data-cy'?: string;
}

/** The default selector for a field, derived from its form path. */
export function fieldCy(name: string, override?: string): string {
  return override ?? `field-${name}`;
}

/**
 * The message to show for a field, including one raised against an entry.
 *
 * An array field fails per element: a role the form does not recognise lands
 * at `roleNames.0`, so the field's own error object carries no `message` of
 * its own. Reading only that message showed the user nothing at all while the
 * form quietly refused to submit, which reads as a dead Save button. The first
 * entry-level message stands in instead.
 */
export function fieldErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const own = (error as { message?: unknown }).message;
  if (typeof own === 'string' && own.length > 0) return own;
  if (Array.isArray(error)) {
    for (const entry of error) {
      const nested = fieldErrorMessage(entry);
      if (nested) return nested;
    }
  }
  return undefined;
}
