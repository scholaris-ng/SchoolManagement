import { useId } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label, Checkbox, Switch } from '@/components/ui/primitives';
import type { SelectOption } from '@/components/ui/input';
import { FieldShell, fieldCy, fieldErrorMessage, type BaseFieldProps } from './field-shell';

/** Fields answering yes/no, or several yes/nos at once. */

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
            error={fieldErrorMessage(fieldState.error)}
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
