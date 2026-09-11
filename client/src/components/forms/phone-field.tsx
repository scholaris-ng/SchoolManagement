import { useEffect, useState } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Country } from 'country-state-city';
import { Input, Select } from '@/components/ui/input';
import { FieldShell, fieldCy, type BaseFieldProps } from './field-shell';

/**
 * A phone number the way a school actually gives it out — a country dial
 * code plus a local number — stored together as one string (`+2348012345678`)
 * so the rest of the app, and the server, never has to know it's two boxes.
 *
 * Shared by every form that collects a phone number; `school-settings-page`
 * re-exports the raw {@link PhoneNumberInput} under its old name rather than
 * keeping a second copy of this logic.
 */

function isoToFlag(isoCode: string): string {
  try {
    return String.fromCodePoint(
      ...isoCode
        .toUpperCase()
        .split('')
        .map((char) => 127397 + char.charCodeAt(0)),
    );
  } catch {
    return '🏳️';
  }
}

interface DialCodeOption {
  isoCode: string;
  name: string;
  dialCode: string;
  flag: string;
}

const DIAL_CODES: DialCodeOption[] = Country.getAllCountries()
  .filter((country) => country.phonecode)
  .map((country) => ({
    isoCode: country.isoCode,
    name: country.name,
    dialCode: `+${country.phonecode}`,
    flag: isoToFlag(country.isoCode),
  }));

function dialCodeFor(isoCode: string): DialCodeOption | undefined {
  return DIAL_CODES.find((option) => option.isoCode === isoCode);
}

/** The dial code whose digits open the value, e.g. `+2348012345678` → the `+234` option. */
function dialCodeMatching(value: string): DialCodeOption | undefined {
  return DIAL_CODES.find((option) => value.startsWith(option.dialCode));
}

function localPart(value: string, dialCode: string): string {
  if (!value.startsWith(dialCode)) return value;
  const rest = value.slice(dialCode.length);
  const dialDigits = dialCode.replace(/\D/g, '');
  return rest.startsWith(dialDigits) ? rest.slice(dialDigits.length) : rest;
}

export interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  /** ISO country code the dial code starts from until the number carries its own — usually the school's regional setting. */
  defaultCountry?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  'data-cy'?: string;
  'aria-describedby'?: string;
}

/** The dial-code-plus-local-number widget, for a caller that manages its own value/onChange rather than react-hook-form. */
export function PhoneNumberInput({
  value,
  onChange,
  defaultCountry,
  invalid,
  disabled,
  id,
  'data-cy': dataCy,
  'aria-describedby': describedBy,
}: PhoneNumberInputProps) {
  const fallback =
    (defaultCountry ? dialCodeFor(defaultCountry) : undefined) ?? dialCodeFor('NG') ?? DIAL_CODES[0];

  const [isoCode, setIsoCode] = useState(() => dialCodeMatching(value)?.isoCode ?? fallback.isoCode);
  const [local, setLocal] = useState(() => localPart(value, (dialCodeMatching(value) ?? fallback).dialCode));

  useEffect(() => {
    const option = dialCodeMatching(value) ?? dialCodeFor(isoCode) ?? fallback;
    setIsoCode(option.isoCode);
    setLocal(localPart(value, option.dialCode));
    // Re-derive only when `value` changes from outside (the record loading,
    // or a clear); typing keeps `local`/`isoCode` and `value` in step already.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (nextIsoCode: string, nextLocal: string) => {
    const option = dialCodeFor(nextIsoCode) ?? fallback;
    let digits = nextLocal.replace(/[^0-9]/g, '');
    const dialDigits = option.dialCode.replace(/\D/g, '');
    if (digits.startsWith(dialDigits)) digits = digits.slice(dialDigits.length);
    onChange(digits ? `${option.dialCode}${digits}` : '');
  };

  return (
    <div className="flex gap-2">
      <Select
        aria-label="Country dial code"
        data-cy={dataCy ? `${dataCy}-dial-code` : undefined}
        className="w-[92px] shrink-0 px-2"
        disabled={disabled}
        value={isoCode}
        onValueChange={(next) => {
          setIsoCode(next);
          emit(next, local);
        }}
        options={DIAL_CODES.map((option) => ({
          value: option.isoCode,
          label: `${option.flag} ${option.dialCode}`,
          description: option.name,
        }))}
      />
      <Input
        id={id}
        data-cy={dataCy}
        type="tel"
        invalid={invalid}
        disabled={disabled}
        aria-describedby={describedBy}
        value={local}
        onChange={(event) => {
          setLocal(event.target.value);
          emit(isoCode, event.target.value);
        }}
        placeholder="Phone number"
        className="flex-1"
      />
    </div>
  );
}

/** The react-hook-form-integrated version, for direct use alongside `TextField` and friends. */
export function PhoneField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  hint,
  className,
  disabled,
  'data-cy': dataCy,
  defaultCountry,
}: BaseFieldProps<T> & {
  /** ISO country code the dial code starts from until the number carries its own — usually the school's regional setting. */
  defaultCountry?: string;
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
            <PhoneNumberInput
              id={id}
              data-cy={fieldCy(name, dataCy)}
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={disabled}
              defaultCountry={defaultCountry}
              value={(field.value as string | undefined) ?? ''}
              onChange={field.onChange}
            />
          )}
        </FieldShell>
      )}
    />
  );
}
