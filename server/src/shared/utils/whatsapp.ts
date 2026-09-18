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
 * A number the way `wa.me` wants it: country code first, digits only, no `+`
 * and no leading zero. `null` when it cannot be made into one — the caller then
 * opens WhatsApp without a recipient and lets the person pick the chat, which is
 * better than a link WhatsApp answers with "phone number is invalid".
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
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

/** "Mrs Chizea" when there is a title, "Ada Chizea" when there is not. */
export function guardianGreeting(guardian: {
  title?: string | null;
  firstName: string;
  lastName: string;
}): string {
  const title = guardian.title?.trim();
  return title ? `${title} ${guardian.lastName}` : `${guardian.firstName} ${guardian.lastName}`.trim();
}

export interface WhatsAppRecipient<G> {
  /** The guardian the message is addressed to, `null` when the child has none. */
  guardian: G | null;
  greeting: string;
  /** International digits, or `null` when WhatsApp should ask who to send it to. */
  phone: string | null;
  /** Why `phone` is `null`, in words for the sender; `null` when a number was found. */
  notice: string | null;
}

/**
 * Who a bill for one child is addressed to, and the number to open WhatsApp on.
 *
 * `guardians` arrive in order of preference — whoever pays the fees, then the
 * primary contact, then the rest. The first with a *usable* number wins, so a
 * paying guardian with no number does not send the message to a picker while
 * their co-guardian's number sits unused. A guardian's alternate number is tried
 * before moving on.
 *
 * When nobody has one the message is still addressed to the first guardian, and
 * `notice` says why WhatsApp will ask who to send it to — silently falling back
 * to that picker looks like the lookup did not work, when what needs fixing is a
 * number on a guardian's record.
 */
export function chooseRecipient<
  G extends {
    title?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    altPhone?: string | null;
  },
>(guardians: G[]): WhatsAppRecipient<G> {
  if (guardians.length === 0) {
    return {
      guardian: null,
      greeting: 'Parent/Guardian',
      phone: null,
      notice: 'This student has no guardian on file, so choose who to send it to in WhatsApp.',
    };
  }

  for (const guardian of guardians) {
    const phone = toWhatsAppNumber(guardian.phone) ?? toWhatsAppNumber(guardian.altPhone);
    if (phone) return { guardian, greeting: guardianGreeting(guardian), phone, notice: null };
  }

  const first = guardians[0];
  const name = `${first.firstName} ${first.lastName}`.trim();
  const problem = first.phone?.trim() ? 'is not a complete phone number' : 'has no phone number on file';
  return {
    guardian: first,
    greeting: guardianGreeting(first),
    phone: null,
    notice: `${name}'s number ${problem}, so choose who to send it to in WhatsApp. Correct it on their guardian record and it will open straight to them next time.`,
  };
}

/** `Sat Aug 22 2026`, in the school's own timezone rather than the server's. */
export function formatMessageDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('month')} ${part('day')} ${part('year')}`;
}

export interface ShareMessageParams {
  /** Who it is addressed to — "Mrs Chizea", "Parent/Guardian". */
  greeting: string;
  /** What is ready, phrased to follow "Dear …," — "your bill", "Ada's invoice for First Term". */
  subject: string;
  fileUrl: string;
  /** A fee schedule is for anyone; a bill or receipt is for one family. */
  confidential: boolean;
  schoolName: string;
  contactEmail?: string;
  now?: Date;
}

/**
 * The text that opens in WhatsApp beside the link. Plain text only — WhatsApp
 * renders `*bold*` and `_italic_`, but a school name or student name containing
 * an asterisk or underscore would be mangled by it, so none is used.
 */
export function buildShareMessage(params: ShareMessageParams): string {
  const lines = [
    `Dear ${params.greeting}, ${params.subject} is ready. You can view it by clicking the secure link below:`,
    '',
    `File: ${params.fileUrl}`,
    `Date: ${formatMessageDate(params.now ?? new Date())}`,
    '',
    params.confidential
      ? 'Please note that this document contains confidential financial information intended only for you. Let us know if you have any questions.'
      : 'Let us know if you have any questions.',
    '',
    'Best regards,',
    '',
    'Accounts Office',
    params.schoolName,
  ];
  if (params.contactEmail) lines.push(params.contactEmail);
  return lines.join('\n');
}
