/**
 * Nigeria's calling code. Guardians' numbers are typed by hand — see the
 * `phone` rule in `guardians.schema.ts`, which allows digits, spaces, dashes,
 * brackets and a leading `+` and nothing stricter — so they arrive as
 * `0803 123 4567`, `+234 803 123 4567`, `803-123-4567` and everything between.
 */
const NG_CODE = '234';
/** A Nigerian national number is ten digits; with the code, thirteen. */
const NG_FULL_LENGTH = 13;

/**
 * A number the way every gateway wants it: country code first, digits only,
 * no `+` and no leading zero — `2348031234567`. WhatsApp's `wa.me` links and
 * KudiSMS's `recipients` field both take exactly this form.
 *
 * `null` when it cannot be made into one, so a caller can say *why* a message
 * did not go rather than sending it to a number the gateway will reject.
 */
export function toInternationalDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const explicitInternational = raw.trim().startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // `00` is the dialling prefix for "international", the same thing as `+`.
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (!explicitInternational && digits.startsWith('0')) digits = NG_CODE + digits.slice(1);
  else if (!explicitInternational && !digits.startsWith(NG_CODE) && digits.length === 10) {
    digits = NG_CODE + digits;
  }

  // `+234 0803…` — the trunk zero kept after the code — is common and wrong.
  if (digits.startsWith(`${NG_CODE}0`)) digits = NG_CODE + digits.slice(NG_CODE.length + 1);

  if (digits.startsWith(NG_CODE)) return digits.length === NG_FULL_LENGTH ? digits : null;
  // Another country's number: only the E.164 limits can be checked, and no
  // country code begins with 0 — `+0803…` is a typo, not a foreign number.
  if (digits.startsWith('0')) return null;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
