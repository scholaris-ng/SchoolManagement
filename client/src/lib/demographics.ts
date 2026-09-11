import { Country, State } from 'country-state-city';
import type { SelectOption } from '@/components/ui/input';

/**
 * The closed lists behind the demographic fields on the student and applicant
 * forms. Values are the display strings themselves, not codes: the API stores
 * plain text and the detail pages print it back verbatim, so a code would have
 * to be translated in every reader.
 */

const COUNTRIES = Country.getAllCountries();

export const NATIONALITY_OPTIONS: SelectOption[] = COUNTRIES.map((country) => ({
  value: country.name,
  label: `${country.flag} ${country.name}`,
}));

/**
 * States belong to a country, so the list on offer follows whichever
 * nationality was picked. Countries the dataset holds no states for come back
 * empty — the caller falls back to a free text box rather than trapping the
 * user with nothing to choose.
 */
export function statesOfNationality(nationality: string | undefined): SelectOption[] {
  const country = COUNTRIES.find((entry) => entry.name === nationality);
  if (!country) return [];
  return State.getStatesOfCountry(country.isoCode).map((state) => ({
    value: state.name,
    label: state.name,
  }));
}

export const RELIGION_OPTIONS: SelectOption[] = [
  'Christianity',
  'Islam',
  'Traditional',
  'Hinduism',
  'Buddhism',
  'Judaism',
  'Other',
  'None',
].map((religion) => ({ value: religion, label: religion }));

export const BLOOD_GROUP_OPTIONS: SelectOption[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(
  (group) => ({ value: group, label: group }),
);

/**
 * Keeps a stored value selectable when it predates the list it now has to fit
 * — an older record saying "Nigerian" still shows itself instead of reading as
 * blank and being lost on the next save.
 */
export function withStoredValue(options: SelectOption[], value: string | undefined): SelectOption[] {
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ value, label: value }, ...options];
}
