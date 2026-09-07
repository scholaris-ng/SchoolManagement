import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
}

export function formatDate(value?: string | Date | null, pattern = 'd MMM yyyy'): string {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
}

export function formatDateTime(value?: string | Date | null): string {
  return formatDate(value, "d MMM yyyy, h:mm a");
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  // Accepts both an ISO timestamp and a bare HH:mm clock time.
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(':').map(Number);
    const suffix = h >= 12 ? 'pm' : 'am';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, '0')}${suffix}`;
  }
  return formatDate(value, 'h:mm a');
}

export function formatRelative(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return '—';
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function toDateInputValue(value?: string | Date | null): string {
  const date = toDate(value);
  return date ? format(date, 'yyyy-MM-dd') : '';
}

/**
 * Currency is a per-school setting; the code is passed in rather than assumed,
 * so the same component serves a Nigerian and a Ghanaian school.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency = 'NGN',
  options: { compact?: boolean; showDecimals?: boolean } = {},
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const { compact = false, showDecimals = true } = options;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : showDecimals ? 2 : 0,
      minimumFractionDigits: compact || !showDecimals ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function ordinal(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = n % 100;
  return `${n}${suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]}`;
}

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function chunkToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`;
  }
  return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${chunkToWords(n % 100)}` : ''}`;
}

/** Receipts are quasi-legal documents; the amount is spelled out on them. */
export function amountInWords(amount: number, currencyName = 'naira', subunit = 'kobo'): string {
  const whole = Math.floor(Math.abs(amount));
  const fraction = Math.round((Math.abs(amount) - whole) * 100);
  if (whole === 0 && fraction === 0) return `zero ${currencyName}`;

  const scales: [number, string][] = [
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
  ];

  let remaining = whole;
  const parts: string[] = [];
  for (const [value, name] of scales) {
    if (remaining >= value) {
      parts.push(`${chunkToWords(Math.floor(remaining / value))} ${name}`);
      remaining %= value;
    }
  }
  if (remaining > 0) parts.push(chunkToWords(remaining));

  const wholeWords = parts.join(' ').trim() || 'zero';
  const fractionWords = fraction > 0 ? ` and ${chunkToWords(fraction)} ${subunit}` : '';
  return `${wholeWords} ${currencyName}${fractionWords} only`;
}
