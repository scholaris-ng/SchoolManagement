import type { SelectOption } from '@/components/ui/input';

/**
 * The closed set of titles a guardian can be given, so "Mr", "mr." and "MR"
 * don't end up as three different spellings on invoices and SMS greetings.
 */
const TITLES = [
  'Mr',
  'Mrs',
  'Miss',
  'Ms',
  'Dr',
  'Prof',
  'Engr',
  'Barr',
  'Hon',
  'Chief',
  'Pastor',
  'Rev',
  'Alhaji',
  'Alhaja',
];

export const TITLE_OPTIONS: SelectOption[] = TITLES.map((title) => ({ value: title, label: title }));

/**
 * The list, plus a title already on a record that isn't in it — from before
 * this was a dropdown. Without it, opening such a guardian to edit would show
 * an empty select and silently clear their title on save.
 */
export function titleOptionsFor(current?: string | null): SelectOption[] {
  const existing = current?.trim();
  if (!existing || TITLES.includes(existing)) return TITLE_OPTIONS;
  return [{ value: existing, label: existing }, ...TITLE_OPTIONS];
}
