import { useEffect, useState } from 'react';
import { Country } from 'country-state-city';
import {
  Label,
  Switch,
} from '@/components/ui/primitives';
import { Input, Select } from '@/components/ui/input';

/**
 * Pieces used by `school-settings-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  /** Server-side message for this field, shown in place of the hint. */
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label required={required}>{label}</Label>
      {children}
      {/*
        The error replaces the hint rather than stacking under it. Once a field
        is wrong, telling the reader what to fix matters more than repeating
        what the field is for, and two lines of small print under one input is
        harder to scan than one.
      */}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch
        data-cy={`toggle-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}

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

/**
 * A phone number the way a school actually gives it out — a country dial
 * code plus a local number — stored together as one string (`+2348012345678`)
 * so the rest of the app, and the server, never has to know it's two boxes.
 */
export function PhoneField({
  value,
  onChange,
  defaultCountry,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  /** ISO country code the dial code starts from until the number carries its own — the school's regional setting. */
  defaultCountry?: string;
  error?: string;
}) {
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
        data-cy="school-settings-phone-dial-code"
        className="w-[92px] shrink-0 px-2"
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
        data-cy="school-settings-phone"
        type="tel"
        invalid={Boolean(error)}
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
