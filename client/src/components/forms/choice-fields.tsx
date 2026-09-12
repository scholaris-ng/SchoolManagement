import { Controller, type FieldValues } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Input, NativeSelect, Select, type SelectOption } from '@/components/ui/input';
import { FieldShell, fieldCy, type BaseFieldProps } from './field-shell';

/** Fields where the user picks from a closed set, plus the date input. */

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
  onValueChange,
}: BaseFieldProps<T> & {
  options: SelectOption[];
  placeholder?: string;
  /** Native selects are noticeably better on low-end Android devices. */
  native?: boolean;
  /** Runs after the form value is set, for a field that steers another field. */
  onValueChange?: (value: string) => void;
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
                onChange={(event) => {
                  field.onChange(event);
                  onValueChange?.(event.target.value);
                }}
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
                onValueChange={(next) => {
                  field.onChange(next);
                  onValueChange?.(next);
                }}
                aria-label={label}
              />
            )
          }
        </FieldShell>
      )}
    />
  );
}

/**
 * A small set of choices that change what the rest of the form asks for.
 *
 * A select hides its options behind a tap and reduces each to a line of text.
 * Where the choice steers the form — who is applying, and therefore which
 * questions follow — the options deserve to be visible and to carry the
 * sentence that explains the consequence, so they are rendered as cards.
 *
 * Built on native radios rather than buttons: keyboard arrow-key behaviour,
 * the group semantics and the selected state all come free and correct.
 */
export function RadioCardField<T extends FieldValues>({
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
  columns = 2,
}: BaseFieldProps<T> & {
  options: { value: string; label: string; description?: string }[];
  columns?: 1 | 2;
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
          {({ describedBy, invalid }) => (
            <div
              role="radiogroup"
              aria-label={label}
              aria-describedby={describedBy}
              data-cy={fieldCy(name, dataCy)}
              className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2')}
            >
              {options.map((option) => {
                const selected = field.value === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-colors',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40',
                      invalid && !selected && 'border-danger/50',
                      disabled && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <input
                      type="radio"
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      value={option.value}
                      checked={selected}
                      disabled={disabled}
                      onChange={() => field.onChange(option.value)}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{option.label}</span>
                      {option.description && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
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
