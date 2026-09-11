import { useState } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, Textarea } from '@/components/ui/input';
import { FieldShell, fieldCy, type BaseFieldProps } from './field-shell';

/** Fields backed by a free-text or numeric input. */

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  hint,
  className,
  disabled,
  'data-cy': dataCy,
  type = 'text',
  placeholder,
  autoComplete,
  leadingIcon,
}: BaseFieldProps<T> & {
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  leadingIcon?: React.ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          label={label}
          required={required}
          description={description}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type={type}
              data-cy={fieldCy(name, dataCy)}
              placeholder={placeholder}
              autoComplete={autoComplete}
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={disabled}
              leadingIcon={leadingIcon}
              {...field}
              value={(field.value as string | number | undefined) ?? ''}
            />
          )}
        </FieldShell>
      )}
    />
  );
}

/**
 * A password box with a control that reveals what was typed.
 *
 * Every password field in the app uses this. Hiding the characters guards
 * against someone reading over a shoulder, which is worth having in a staff
 * room, but it also means a mistyped password is invisible — and the passwords
 * this app hands out are machine-generated strings where l, 1 and I look alike.
 * Letting the person look is what makes those typeable.
 *
 * The reveal resets itself: it is per-field state, so nothing stays visible
 * once the form unmounts.
 */
export function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  hint,
  className,
  disabled,
  'data-cy': dataCy,
  autoComplete = 'current-password',
  placeholder,
  leadingIcon,
}: BaseFieldProps<T> & {
  autoComplete?: string;
  placeholder?: string;
  leadingIcon?: React.ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);
  const cy = fieldCy(name, dataCy);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          label={label}
          required={required}
          description={description}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type={revealed ? 'text' : 'password'}
              data-cy={cy}
              placeholder={placeholder}
              autoComplete={autoComplete}
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={disabled}
              leadingIcon={leadingIcon}
              trailingIcon={
                <button
                  type="button"
                  data-cy={`${cy}-reveal`}
                  onClick={() => setRevealed((current) => !current)}
                  disabled={disabled}
                  /*
                    The label says what pressing it does, not what state the
                    field is in. A screen reader user hears the action they are
                    about to take rather than having to infer it.
                  */
                  aria-label={revealed ? 'Hide password' : 'Show password'}
                  aria-pressed={revealed}
                  className="grid place-items-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {revealed ? <EyeOff /> : <Eye />}
                </button>
              }
              {...field}
              value={(field.value as string | undefined) ?? ''}
            />
          )}
        </FieldShell>
      )}
    />
  );
}

export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  hint,
  className,
  disabled,
  'data-cy': dataCy,
  min,
  max,
  step,
  placeholder,
  prefix,
}: BaseFieldProps<T> & {
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          label={label}
          required={required}
          description={description}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
        >
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              {prefix && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {prefix}
                </span>
              )}
              <Input
                id={id}
                type="number"
                data-cy={fieldCy(name, dataCy)}
                inputMode="decimal"
                min={min}
                max={max}
                step={step}
                placeholder={placeholder}
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={disabled}
                className={cn(prefix && 'pl-8', 'tabular-nums')}
                value={field.value ?? ''}
                onChange={(event) =>
                  field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                }
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            </div>
          )}
        </FieldShell>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  hint,
  className,
  disabled,
  'data-cy': dataCy,
  rows,
  placeholder,
  maxLength,
}: BaseFieldProps<T> & { rows?: number; placeholder?: string; maxLength?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string | undefined) ?? '';
        return (
          <FieldShell
            label={label}
            required={required}
            description={description}
            hint={
              maxLength ? (
                <span className="tabular-nums">
                  {value.length} / {maxLength}
                </span>
              ) : (
                hint
              )
            }
            error={fieldState.error?.message}
            className={className}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                data-cy={fieldCy(name, dataCy)}
                rows={rows}
                placeholder={placeholder}
                maxLength={maxLength}
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={disabled}
                {...field}
                value={value}
              />
            )}
          </FieldShell>
        );
      }}
    />
  );
}
