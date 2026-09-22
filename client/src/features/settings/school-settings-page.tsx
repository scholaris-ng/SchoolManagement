import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { City, Country, State } from 'country-state-city';
import { useSchool, useSmsStatus, useUpdateSchool } from './api';
import { isApiError } from '@/lib/api-error';
import type { School } from '@/types/tenant';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Select } from '@/components/ui/input';
import { FileUpload } from '@/components/forms/file-upload';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/primitives';
import { formatCurrency } from '@/lib/format';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import { SettingsTabs } from './settings-tabs';
import { Field, PhoneField, Toggle } from './school-settings-page-parts';
import { BirthdaySmsCard } from './birthday-sms-card';
import { validateSchoolDraft } from './school-settings.schema';

const COUNTRIES = Country.getAllCountries();

const CURRENCIES = [
  { code: 'NGN', symbol: '₦', label: 'Nigerian naira' },
  { code: 'GHS', symbol: '₵', label: 'Ghanaian cedi' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan shilling' },
  { code: 'USD', symbol: '$', label: 'US dollar' },
  { code: 'GBP', symbol: '£', label: 'Pound sterling' },
];

const TIMEZONES = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Europe/London',
  'UTC',
];

/**
 * The school's own identity and defaults.
 *
 * Everything here is per-tenant: currency, timezone, brand colour, and the
 * policy switches that change how the product behaves for this school — none of
 * it is hardcoded anywhere else in the app.
 */
export function SchoolSettingsPage() {
  const school = useSchool();
  const update = useUpdateSchool();
  // A second, independent mutation instance for toggles: sharing `update`
  // would make its `isPending` flicker the "Save changes" button's spinner
  // for a save the administrator never asked for.
  const toggleSave = useUpdateSchool();
  const smsStatus = useSmsStatus();

  const [draft, setDraft] = useState<Partial<School> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Guarded by `dirty`: a toggle's own autosave (see `saveToggle` below)
    // refreshes `school.data` in the background, and this effect must not
    // clobber an edit still in progress elsewhere on the form when that
    // happens — only an untouched draft is safe to replace wholesale.
    if (school.data && !dirty) {
      setDraft(school.data);
      setDirty(false);
    }
  }, [school.data, dirty]);

  const headerBreadcrumbs = [{ label: 'Administration' }, { label: 'School settings' }];

  if (school.isPending || !draft) {
    return (
      <PageContainer>
        <PageHeader loading title="" breadcrumbs={headerBreadcrumbs} />
        <LoadingState label="Loading school settings…" />
      </PageContainer>
    );
  }

  if (school.isError) {
    return (
      <PageContainer>
        <PageHeader title="School settings" breadcrumbs={headerBreadcrumbs} />
        <ErrorState error={school.error} onRetry={() => void school.refetch()} />
      </PageContainer>
    );
  }

  const set = (patch: Partial<School>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    const touched = Object.keys(patch);
    if (touched.some((key) => key in validationErrors)) {
      setValidationErrors((current) => {
        const next = { ...current };
        for (const key of touched) delete next[key];
        return next;
      });
    }
  };

  const setBranding = (patch: Partial<School['branding']>) => {
    setDraft((current) => ({
      ...current,
      branding: { ...(current?.branding as School['branding']), ...patch },
    }));
    setDirty(true);
  };

  const setSettings = (patch: Partial<School['settings']>) => {
    setDraft((current) => ({
      ...current,
      settings: { ...(current?.settings as School['settings']), ...patch },
    }));
    setDirty(true);
  };

  /**
   * A toggle saves itself the instant it is flipped, rather than waiting on
   * "Save changes" — a school administrator switching birthday texts on has
   * no reason to expect a second step, and the previous behaviour of quietly
   * discarding the flip if they navigated away without saving is exactly the
   * bug this replaces.
   *
   * Deliberately outside the `dirty` draft: it patches and requests only the
   * one key changed, under whatever version the server currently holds, so a
   * genuinely unsaved edit sitting elsewhere in the form (the school name,
   * say) is left alone and still requires its own "Save changes".
   */
  const saveToggle = (patch: Partial<School['settings']>) => {
    const previousSettings = draft.settings;
    setDraft((current) => ({
      ...current,
      settings: { ...(current?.settings as School['settings']), ...patch },
    }));
    toggleSave.mutate(
      { values: { settings: patch }, version: school.data?.version ?? 0 },
      {
        onError: () => {
          setDraft((current) => ({ ...current, settings: previousSettings }));
        },
      },
    );
  };

  const save = async () => {
    const errors = validateSchoolDraft(draft);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    await update.mutateAsync({
      values: editableFields(draft),
      version: school.data?.version ?? 0,
    });
    setDirty(false);
  };

  // Server-side messages, keyed by the field they belong to, so each one is
  // shown under the box it is about rather than only as a list at the top.
  // Validation caught before the request ever went out takes precedence over
  // whatever the last save attempt reported for the same field.
  const fieldErrors = {
    ...(isApiError(update.error) ? update.error.fieldErrors() : {}),
    ...validationErrors,
  };

  // States belong to a country, so the list on offer follows whichever
  // country the school picked under Regional — pick that first, or this list
  // has nothing to show.
  const states = draft.settings?.country ? State.getStatesOfCountry(draft.settings.country) : [];

  // Cities belong to a state the same way states belong to a country above —
  // looked up by the state's ISO code since that's what the dataset indexes
  // by, not the name the form stores. A state the dataset holds no cities
  // for falls back to a free text box below rather than trapping the user
  // with nothing to choose.
  const selectedState = states.find((entry) => entry.name === draft.state);
  const cities =
    draft.settings?.country && selectedState
      ? City.getCitiesOfState(draft.settings.country, selectedState.isoCode)
      : [];

  return (
    <PageContainer>
      <UnsavedChangesGuard when={dirty && !update.isPending} />

      <PageHeader
        title="School settings"
        description="Your school's identity, branding and the policies that shape how the product behaves."
        breadcrumbs={headerBreadcrumbs}
        meta={
          smsStatus.data ? (
            <Badge
              tone={smsStatus.data.credits === 0 ? 'danger' : 'primary'}
              data-cy="settings-sms-credits"
              title="Prepaid SMS credit for birthday messages and other texts"
            >
              {smsStatus.data.credits.toLocaleString()} SMS credit ·{' '}
              {formatCurrency(smsStatus.data.credits * smsStatus.data.unitPriceNgn, 'NGN', { showDecimals: false })}
            </Badge>
          ) : undefined
        }
        actions={
          <Button data-cy="settings-school-settings-save-changes" onClick={() => void save()} loading={update.isPending} disabled={!dirty}>
            <Save />
            Save changes
          </Button>
        }
      />

      <SettingsTabs />

      {/*
        The header and tabs above take the page's full standard width, like
        every other settings screen — only this form's own content narrows,
        so a single column of fields stays readable instead of stretching
        edge to edge.
      */}
      <div className="max-w-3xl space-y-6">
        <FormError error={update.error} />

        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="School name" required error={fieldErrors.name}>
              <Input
                data-cy="school-settings-name"
                value={draft.name ?? ''}
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>
            <Field label="Short name" hint="Used in the sidebar and on documents." error={fieldErrors.shortName}>
              <Input
                data-cy="school-settings-short-name"
                value={draft.shortName ?? ''}
                onChange={(event) => set({ shortName: event.target.value })}
              />
            </Field>
            {/*
              Read-only on purpose. The code prefixes every verification code the
              school has ever issued, so changing it would orphan certificates
              already in circulation — the API refuses it for that reason, and an
              editable box here only invited a change that could not be saved.
            */}
            <Field
              label="School code"
              hint="Prefixes verification codes, so it cannot be changed once issued."
            >
              <Input data-cy="school-settings-code" value={draft.code ?? ''} readOnly disabled />
            </Field>
            <Field label="Website" error={fieldErrors.website}>
              <Input
                data-cy="school-settings-website"
                type="url"
                value={draft.website ?? ''}
                onChange={(event) => set({ website: event.target.value })}
                placeholder="https://"
              />
            </Field>
            {/*
              Read-only, the same as the school code above: this is the
              school's registered address of record, not a detail to change
              casually from a settings form. Families see the address a
              school actually publishes for enquiries — the one under
              Website settings — which stays fully editable on its own page.
            */}
            <Field
              label="Email"
              required
              hint="Your school's registered email. Contact support to change it."
            >
              <Input data-cy="school-settings-email" type="email" value={draft.email ?? ''} readOnly disabled />
            </Field>
            <Field label="Phone" required error={fieldErrors.phone}>
              <PhoneField
                data-cy="school-settings-phone"
                value={draft.phone ?? ''}
                onChange={(phone) => set({ phone })}
                defaultCountry={draft.settings?.country}
                invalid={Boolean(fieldErrors.phone)}
              />
            </Field>
            <Field
              label="Address"
              required
              className="sm:col-span-2"
              error={fieldErrors.addressLine1}
            >
              <Input
                data-cy="school-settings-address-line1"
                value={draft.addressLine1 ?? ''}
                onChange={(event) => set({ addressLine1: event.target.value })}
              />
            </Field>
            <Field
              label="City"
              required
              error={fieldErrors.city}
              hint={cities.length === 0 && !selectedState ? 'Pick a state to choose from a list.' : undefined}
            >
              {cities.length > 0 ? (
                <Select
                  data-cy="school-settings-city"
                  aria-label="City"
                  invalid={Boolean(fieldErrors.city)}
                  value={draft.city || undefined}
                  onValueChange={(city) => set({ city })}
                  options={cities.map((entry) => ({ value: entry.name, label: entry.name }))}
                  placeholder="Select a city"
                />
              ) : (
                <Input
                  data-cy="school-settings-city"
                  value={draft.city ?? ''}
                  onChange={(event) => set({ city: event.target.value })}
                />
              )}
            </Field>
            <Field
              label="State"
              required
              error={fieldErrors.state}
              hint={!draft.settings?.country ? 'Pick a country under Regional first.' : undefined}
            >
              <Select
                data-cy="school-settings-state"
                aria-label="State"
                invalid={Boolean(fieldErrors.state)}
                disabled={!draft.settings?.country}
                value={states.find((entry) => entry.name === draft.state)?.isoCode}
                onValueChange={(isoCode) => {
                  const match = states.find((entry) => entry.isoCode === isoCode);
                  // The city box above picks from this state's list; the old
                  // value is very unlikely to still be one of them.
                  if (match) set({ state: match.name, city: '' });
                }}
                options={states.map((entry) => ({ value: entry.isoCode, label: entry.name }))}
                placeholder="Select a state"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              Applied across the app, report cards and receipts the moment you save.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload
              variant="avatar"
              preset="image"
              purpose="school-logo"
              label="School logo"
              description="Appears on report cards, receipts and the public website."
              value={draft.branding?.logoUrl ? { url: draft.branding.logoUrl } : null}
              onUploaded={(file) => setBranding({ logoUrl: file.downloadUrl })}
              onRemove={() => setBranding({ logoUrl: null })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary colour">
                <div className="flex items-center gap-2">
                  <input
                    data-cy="school-settings-primary-color"
                    type="color"
                    aria-label="Primary colour"
                    value={draft.branding?.primaryColor ?? '#4f46e5'}
                    onChange={(event) => setBranding({ primaryColor: event.target.value })}
                    className="size-9 shrink-0 cursor-pointer rounded border border-input"
                  />
                  <Input
                    data-cy="school-settings-primary-color-2"
                    value={draft.branding?.primaryColor ?? ''}
                    onChange={(event) => setBranding({ primaryColor: event.target.value })}
                  />
                </div>
              </Field>
              <Field label="Accent colour">
                <div className="flex items-center gap-2">
                  <input
                    data-cy="school-settings-accent-color"
                    type="color"
                    aria-label="Accent colour"
                    value={draft.branding?.accentColor ?? '#0ea5e9'}
                    onChange={(event) => setBranding({ accentColor: event.target.value })}
                    className="size-9 shrink-0 cursor-pointer rounded border border-input"
                  />
                  <Input
                    data-cy="school-settings-accent-color-2"
                    value={draft.branding?.accentColor ?? ''}
                    onChange={(event) => setBranding({ accentColor: event.target.value })}
                  />
                </div>
              </Field>
              <Field label="Motto" className="sm:col-span-2">
                <Input
                  data-cy="school-settings-motto"
                  value={draft.branding?.motto ?? ''}
                  onChange={(event) => setBranding({ motto: event.target.value })}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regional</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency">
              <NativeSelect
                data-cy="school-settings-currency"
                value={draft.settings?.currency ?? 'NGN'}
                onChange={(event) => {
                  const currency = CURRENCIES.find((entry) => entry.code === event.target.value);
                  setSettings({
                    currency: event.target.value,
                    currencySymbol: currency?.symbol ?? event.target.value,
                  });
                }}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label} ({currency.symbol})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Timezone">
              <NativeSelect
                data-cy="school-settings-timezone"
                value={draft.settings?.timezone ?? 'Africa/Lagos'}
                onChange={(event) => setSettings({ timezone: event.target.value })}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Country" hint="Also determines the states on offer above, under Identity.">
              <Select
                data-cy="school-settings-country"
                aria-label="Country"
                value={draft.settings?.country || undefined}
                onValueChange={(isoCode) => {
                  setSettings({ country: isoCode });
                  // The State box picks from this country's list; the old value
                  // is very unlikely to still be one of them.
                  set({ state: '' });
                }}
                options={COUNTRIES.map((country) => ({
                  value: country.isoCode,
                  label: country.name,
                }))}
                placeholder="Select a country"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
            <CardDescription>
              These change how the product behaves for everyone at this school.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="Require photo consent"
              description="Student photographs are hidden from the public website, the news feed and printed documents unless a guardian has consented. Strongly recommended."
              checked={draft.settings?.requirePhotoConsent ?? true}
              onChange={(value) => saveToggle({ requirePhotoConsent: value })}
              saving={toggleSave.isPending}
            />
            <Toggle
              label="Same-day absence alerts"
              description="Notify a guardian the first time their child is marked absent without explanation."
              checked={draft.settings?.absenceAlertEnabled ?? true}
              onChange={(value) => saveToggle({ absenceAlertEnabled: value })}
              saving={toggleSave.isPending}
            />
            {draft.settings?.absenceAlertEnabled && (
              <div className="pl-1 pt-2">
                <Field label="Send alerts after" hint="Registers taken later still send once.">
                  <Input
                    data-cy="school-settings-absence-alert-cutoff"
                    type="time"
                    value={draft.settings?.absenceAlertCutoff ?? '10:00'}
                    onChange={(event) => setSettings({ absenceAlertCutoff: event.target.value })}
                    className="w-auto"
                  />
                </Field>
              </div>
            )}
            <Toggle
              label="Notify parents when results are published"
              checked={draft.settings?.resultPublishNotification ?? true}
              onChange={(value) => saveToggle({ resultPublishNotification: value })}
              saving={toggleSave.isPending}
            />
            <Toggle
              label="Allow parent–teacher messaging"
              description="Parents can start a conversation with staff connected to their own children."
              checked={draft.settings?.allowParentTeacherMessaging ?? true}
              onChange={(value) => saveToggle({ allowParentTeacherMessaging: value })}
              saving={toggleSave.isPending}
            />

            {draft.settings?.requirePhotoConsent === false && (
              <Alert tone="warning" title="Photo consent is off">
                Student photographs may then appear on public pages and printed documents. Make sure
                this matches the permission your families have actually given.
              </Alert>
            )}
          </CardContent>
        </Card>

        <BirthdaySmsCard
          school={{ name: draft.name ?? '', shortName: draft.shortName ?? '' }}
          settings={draft.settings}
          onChange={setSettings}
          onToggleEnabled={(value) => saveToggle({ birthdaySmsEnabled: value })}
          togglingEnabled={toggleSave.isPending}
        />
      </div>
    </PageContainer>
  );
}

/**
 * The fields this endpoint actually accepts.
 *
 * The draft is seeded from the whole school record so the form can display it,
 * but a record is not a patch: sending it back includes `id`, `code`, `email`,
 * `status`, `version` and the timestamps, none of which an administrator may
 * edit from here — `email` is read-only on the form above for the same
 * reason `code` is, and is left out of this list so the box being disabled
 * is not the only thing standing between it and a change. The API refuses
 * the rest of the lot regardless, and the page then reported a validation
 * failure for a form the user had filled in correctly.
 *
 * Blank optional fields are dropped rather than sent as empty strings. Leaving
 * the short-name box empty means "no change", not "erase it" — `phone`,
 * `addressLine1`, `city` and `state` never reach this blank, since
 * `validateSchoolDraft` blocks the save first if any of those are empty.
 */
function editableFields(draft: Partial<School>): Partial<School> {
  const values: Partial<School> = {};

  const text = [
    'name',
    'shortName',
    'phone',
    'website',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
  ] as const;

  for (const key of text) {
    const value = draft[key];
    if (typeof value === 'string' && value.trim() !== '') values[key] = value.trim();
  }

  if (draft.branding) values.branding = draft.branding;
  if (draft.settings) values.settings = draft.settings;

  return values;
}
