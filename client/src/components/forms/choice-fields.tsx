import { Controller, type FieldValues } from 'react-hook-form';
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
