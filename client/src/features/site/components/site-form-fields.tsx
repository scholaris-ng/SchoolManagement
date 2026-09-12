import { useId } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneNumberInput } from '@/components/forms/phone-field';

/**
 * Form controls for the public website.
 *
 * The marketing site declares its own palette on `.school-site` and never
 * reads the application's design tokens (`site.css`), so it cannot reuse the
 * admin form fields — those are built on the signed-in theme and would follow
 * an administrator's dark mode onto a prospectus. These are the same controls
 * in the site's own language: one label, one input, one message, and a focus
 * ring a parent can see on a phone in daylight.
 *
 * The phone field is the deliberate exception: rather than re-implement the
 * dial-code-plus-local-number logic a second time, `SitePhoneField` below
 * wraps the same `PhoneNumberInput` the rest of the app uses, inside this
 * module's own label and error chrome.
 */

const CONTROL =
  'w-full rounded-lg border bg-white px-3.5 py-2.5 text-[0.9375rem] text-[var(--site-ink)] outline-none transition-colors placeholder:text-[var(--site-muted)] focus:ring-4 disabled:opacity-60';

const CONTROL_REST = 'border-[var(--site-line)] focus:border-[var(--site-brand)] focus:ring-[var(--site-brand-soft)]';

/** Red only once a field has actually been answered wrongly. */
const CONTROL_INVALID = 'border-[var(--site-accent)] focus:border-[var(--site-accent)] focus:ring-[color-mix(in_srgb,var(--site-accent)_16%,transparent)]';

interface ShellProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}

export function SiteField({ label, required, hint, error, className, children }: ShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--site-ink)]">
        {label}
        {required && (
          <span className="ml-0.5 text-[var(--site-accent)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-[var(--site-accent)]">
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-1.5 text-xs text-[var(--site-muted)]">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

interface FieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
}

export function SiteTextField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  className,
  type = 'text',
  placeholder,
  max,
  autoComplete,
}: FieldProps<T> & {
  type?: 'text' | 'email' | 'tel' | 'date';
  placeholder?: string;
  /** For the date input: nobody is born tomorrow. */
  max?: string;
  autoComplete?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SiteField
          label={label}
          required={required}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type={type}
              max={max}
              placeholder={placeholder}
              autoComplete={autoComplete}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(CONTROL, invalid ? CONTROL_INVALID : CONTROL_REST)}
              {...field}
              value={(field.value as string | undefined) ?? ''}
            />
          )}
        </SiteField>
      )}
    />
  );
}

/**
 * A phone number with its country dial code, reusing the exact widget the
 * signed-in app uses (`@/components/forms/phone-field`) rather than a second
 * copy of the digit-sanitising and dial-code-matching logic it carries.
 *
 * Defaults the dial code to Nigeria: every school this site currently serves
 * is Nigerian, matching the same assumption the admission form already makes
 * for nationality.
 */
export function SitePhoneField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  className,
  defaultCountry = 'NG',
}: FieldProps<T> & { defaultCountry?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SiteField
          label={label}
          required={required}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
        >
          {({ id, describedBy, invalid }) => (
            <PhoneNumberInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              defaultCountry={defaultCountry}
              value={(field.value as string | undefined) ?? ''}
              onChange={field.onChange}
            />
          )}
        </SiteField>
      )}
    />
  );
}

export function SiteSelectField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  className,
  options,
  placeholder = 'Select…',
  onValueChange,
}: FieldProps<T> & {
  options: { value: string; label: string }[];
  placeholder?: string;
  /** Runs after the form value is set, for a field that steers another field. */
  onValueChange?: (value: string) => void;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SiteField
          label={label}
          required={required}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
        >
          {({ id, describedBy, invalid }) => (
            // Native, deliberately: it is the control a parent's phone already
            // knows how to render, and it costs nothing to load.
            <select
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(CONTROL, invalid ? CONTROL_INVALID : CONTROL_REST)}
              {...field}
              value={(field.value as string | undefined) ?? ''}
              onChange={(event) => {
                field.onChange(event);
                onValueChange?.(event.target.value);
              }}
            >
              <option value="">{placeholder}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </SiteField>
      )}
    />
  );
}

export function SiteTextareaField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  className,
  rows = 3,
  placeholder,
}: FieldProps<T> & { rows?: number; placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SiteField
          label={label}
          required={required}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
        >
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              rows={rows}
              placeholder={placeholder}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(CONTROL, 'resize-y', invalid ? CONTROL_INVALID : CONTROL_REST)}
              {...field}
              value={(field.value as string | undefined) ?? ''}
            />
          )}
        </SiteField>
      )}
    />
  );
}

/**
 * The choice that steers the rest of the form, as two cards rather than a
 * dropdown — it is the first thing a visitor is asked and the answer changes
 * what they are asked next, so it is worth the space.
 */
export function SiteChoiceField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  className,
}: Omit<FieldProps<T>, 'required' | 'hint'> & {
  options: { value: string; label: string; description: string }[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={className}>
          <div role="radiogroup" aria-label={label} className="grid gap-3 sm:grid-cols-2">
            {options.map((option) => {
              const selected = field.value === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                    selected
                      ? 'border-[var(--site-brand)] bg-[var(--site-brand-soft)]'
                      : 'border-[var(--site-line)] hover:border-[var(--site-brand)]',
                  )}
                >
                  <input
                    type="radio"
                    className="mt-0.5 size-4 shrink-0 accent-[var(--site-brand)]"
                    value={option.value}
                    checked={selected}
                    onChange={() => field.onChange(option.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--site-ink)]">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--site-muted)]">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {fieldState.error?.message && (
            <p role="alert" className="mt-2 flex items-center gap-1 text-xs text-[var(--site-accent)]">
              <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}

export function SiteCheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  className,
}: Omit<FieldProps<T>, 'required' | 'hint' | 'label'> & { label: React.ReactNode }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={className}>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--site-body)]">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--site-brand)]"
              checked={Boolean(field.value)}
              onChange={(event) => field.onChange(event.target.checked)}
              onBlur={field.onBlur}
              name={field.name}
            />
            <span>{label}</span>
          </label>
          {fieldState.error?.message && (
            <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-[var(--site-accent)]">
              <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
