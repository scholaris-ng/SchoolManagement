/**
 * Money written out in words, the way a Nigerian school receipt writes it.
 *
 * "One hundred and eighty-five thousand naira only" is not decoration: an
 * amount in figures can be altered with a pen, and the words are what a bursar
 * — and an auditor — reads to check it was not. The trailing "only" is part of
 * the convention, and so is the British "and" before the last two digits of a
 * hundred, which the American spelling drops.
 *
 * Kept in `shared` rather than in finance because it is arithmetic on a
 * number, with no idea what a fee is.
 */

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

/** Short scale, which is what Nigerian English uses. */
const SCALES: { value: number; name: string }[] = [
  { value: 1_000_000_000_000, name: 'trillion' },
  { value: 1_000_000_000, name: 'billion' },
  { value: 1_000_000, name: 'million' },
  { value: 1_000, name: 'thousand' },
];

/** 0–999 in words. Hyphenated in the twenties and up, as writing convention has it. */
function underThousand(value: number): string {
  if (value < 20) return ONES[value];
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)];
    const ones = value % 10;
    return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
  }

  const hundreds = `${ONES[Math.floor(value / 100)]} hundred`;
  const remainder = value % 100;
  // British "and": "one hundred and five", never "one hundred five".
  return remainder === 0 ? hundreds : `${hundreds} and ${underThousand(remainder)}`;
}

/**
 * A whole number in words. Negative input is spelled "minus …" rather than
 * rejected — a reversal is a real thing for a ledger to print.
 */
export function numberToWords(value: number): string {
  if (!Number.isFinite(value)) return '';

  const whole = Math.trunc(Math.abs(value));
  if (whole === 0) return value < 0 ? 'minus zero' : 'zero';

  const parts: string[] = [];
  let remainder = whole;

  for (const scale of SCALES) {
    if (remainder >= scale.value) {
      const count = Math.floor(remainder / scale.value);
      parts.push(`${numberToWords(count)} ${scale.name}`);
      remainder %= scale.value;
    }
  }

  if (remainder > 0) {
    // "and" again where the tail is under a hundred: "two thousand and five",
    // but "two thousand one hundred".
    if (parts.length > 0 && remainder < 100) parts.push('and');
    parts.push(underThousand(remainder));
  }

  return `${value < 0 ? 'minus ' : ''}${parts.join(' ')}`;
}

/** What each supported currency calls its major and minor unit on a receipt. */
const CURRENCY_UNITS: Record<string, { major: string; minor: string }> = {
  NGN: { major: 'naira', minor: 'kobo' },
  USD: { major: 'dollars', minor: 'cents' },
  GBP: { major: 'pounds', minor: 'pence' },
  GHS: { major: 'cedis', minor: 'pesewas' },
  KES: { major: 'shillings', minor: 'cents' },
};

/**
 * The full receipt line.
 *
 * A round amount ends "…naira only". One with kobo names both units and drops
 * the "only", because "only" is what says there is nothing after the figure.
 * An unknown currency code falls back to the code itself rather than guessing
 * a unit name — "one thousand NGX only" is odd but honest.
 */
export function amountInWords(amount: number, currency = 'NGN'): string {
  const units = CURRENCY_UNITS[currency.toUpperCase()] ?? {
    major: currency.toUpperCase(),
    minor: 'cents',
  };

  const negative = amount < 0;
  const absolute = Math.abs(amount);
  // Rounded to the minor unit first: 0.1 + 0.2 arithmetic must not produce
  // "…and twenty-nine kobo" on a thirty-kobo payment.
  const totalMinor = Math.round(absolute * 100);
  const major = Math.floor(totalMinor / 100);
  const minor = totalMinor % 100;

  const prefix = negative ? 'minus ' : '';
  const majorWords = `${numberToWords(major)} ${units.major}`;

  const sentence =
    minor === 0
      ? `${majorWords} only`
      : `${majorWords}, ${numberToWords(minor)} ${units.minor}`;

  return capitaliseFirst(`${prefix}${sentence}`);
}

function capitaliseFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
