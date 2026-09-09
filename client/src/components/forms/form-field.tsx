import { useId } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/primitives';
import { Input, NativeSelect, Select, Textarea, type SelectOption } from '@/components/ui/input';
import { Checkbox, Switch } from '@/components/ui/primitives';

/**
 * Form field primitives.
 *
 * Each one wires up label/description/error ids so assistive technology reads
 * the whole field, not just the input — labels, `aria-describedby` and
 * `aria-invalid` are handled here so no screen forgets them.
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

interface BaseFieldProps<T extends FieldValues> {
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
function fieldCy(name: string, override?: string): string {
  return override ?? `field-${name}`;
}

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

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  hint,
  className,
  disabled,
  'data-cy': dataCy,
  options,
  placeholder,
  native,
}: BaseFieldProps<T> & {
  options: SelectOption[];
  placeholder?: string;
  /** Native selects are noticeably better on low-end Android devices. */
  native?: boolean;
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
          {({ id, describedBy, invalid }) =>
            native ? (
              <NativeSelect
                id={id}
                data-cy={fieldCy(name, dataCy)}
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={disabled}
                {...field}
                value={(field.value as string | undefined) ?? ''}
              >
                <option value="">{placeholder ?? 'Select…'}</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Select
                id={id}
                data-cy={fieldCy(name, dataCy)}
                options={options}
                placeholder={placeholder}
                disabled={disabled}
                invalid={invalid}
                value={(field.value as string | undefined) ?? undefined}
                onValueChange={field.onChange}
                aria-label={label}
              />
            )
          }
        </FieldShell>
      )}
    />
  );
}

export function DateField<T extends FieldValues>(
  props: BaseFieldProps<T> & { min?: string; max?: string },
) {
  const { min, max, ...rest } = props;
  return (
    <Controller
      control={rest.control}
      name={rest.name}
      render={({ field, fieldState }) => (
        <FieldShell
          label={rest.label}
          required={rest.required}
          description={rest.description}
          hint={rest.hint}
          error={fieldState.error?.message}
          className={rest.className}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="date"
              data-cy={fieldCy(rest.name, rest['data-cy'])}
              min={min}
              max={max}
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={rest.disabled}
              {...field}
              value={(field.value as string | undefined) ?? ''}
            />
          )}
        </FieldShell>
      )}
    />
  );
}

export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  'data-cy': dataCy,
}: Omit<BaseFieldProps<T>, 'required' | 'hint'>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn('space-y-1', className)}>
          <div className="flex items-start gap-2.5">
            <Checkbox
              id={id}
              data-cy={fieldCy(name, dataCy)}
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              disabled={disabled}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <Label htmlFor={id} className="cursor-pointer">
                {label}
              </Label>
              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {fieldState.error && (
            <p role="alert" className="text-xs text-danger">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  'data-cy': dataCy,
}: Omit<BaseFieldProps<T>, 'required' | 'hint'>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={cn('flex items-start justify-between gap-4 py-1', className)}>
          <div className="min-w-0">
            <Label htmlFor={id} className="cursor-pointer">
              {label}
            </Label>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          <Switch
            id={id}
            data-cy={fieldCy(name, dataCy)}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
        </div>
      )}
    />
  );
}

/**
 * Multi-select rendered as a checkbox list rather than a tag combobox.
 *
 * The choices here are always short, closed sets — the subjects a teacher
 * teaches, the levels a fee applies to — and a visible list of checkboxes is
 * faster to scan, keyboard-navigable by default, and far kinder to a screen
 * reader than a custom widget would be.
 */
export function MultiSelectField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  hint,
  className,
  disabled,
  'data-cy': dataCy,
  options,
  emptyLabel = 'Nothing to choose from yet.',
  columns = 2,
}: BaseFieldProps<T> & {
  options: SelectOption[];
  emptyLabel?: string;
  columns?: 1 | 2 | 3;
}) {
  const gridClass = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[columns];

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];
        const toggle = (value: string) =>
          field.onChange(
            selected.includes(value)
              ? selected.filter((entry) => entry !== value)
              : [...selected, value],
          );

        return (
          <FieldShell
            label={label}
            required={required}
            description={description}
            hint={hint}
            error={fieldState.error?.message}
            className={className}
          >
            {({ describedBy }) =>
              options.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  {emptyLabel}
                </p>
              ) : (
                <div
                  role="group"
                  aria-label={label}
                  data-cy={fieldCy(name, dataCy)}
                  aria-describedby={describedBy}
                  className={cn(
                    'scrollbar-thin grid max-h-56 gap-2 overflow-y-auto rounded-md border border-input p-3',
                    gridClass,
                  )}
                >
                  {options.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-2.5 text-sm"
                    >
                      <Checkbox
                        data-cy={`${fieldCy(name, dataCy)}-option-${option.value}`}
                        checked={selected.includes(option.value)}
                        onCheckedChange={() => toggle(option.value)}
                        disabled={disabled || option.disabled}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )
            }
          </FieldShell>
        );
      }}
    />
  );
}

/** Groups related fields with a heading, used across the long setup forms. */
export function FormSection({
  title,
  description,
  children,
  className,
  columns = 2,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  const gridClass = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[columns];
  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className={cn('grid gap-4', gridClass)}>{children}</div>
    </section>
  );
}
