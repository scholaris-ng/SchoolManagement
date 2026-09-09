import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useSchool, useUpdateSchool } from './api';
import type { School } from '@/types/tenant';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { FileUpload } from '@/components/forms/file-upload';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import { SettingsTabs } from './settings-tabs';

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

  const [draft, setDraft] = useState<Partial<School> | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (school.data) {
      setDraft(school.data);
      setDirty(false);
    }
  }, [school.data]);

  if (school.isPending || !draft) {
    return (
      <PageContainer width="narrow">
        <LoadingState label="Loading school settings…" />
      </PageContainer>
    );
  }

  if (school.isError) {
    return (
      <PageContainer width="narrow">
        <ErrorState error={school.error} onRetry={() => void school.refetch()} />
      </PageContainer>
    );
  }

  const set = (patch: Partial<School>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
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

  const save = async () => {
    await update.mutateAsync({ values: draft, version: school.data?.version ?? 0 });
    setDirty(false);
  };

  return (
    <PageContainer width="narrow">
      <UnsavedChangesGuard when={dirty && !update.isPending} />

      <PageHeader
        title="School settings"
        description="Your school's identity, branding and the policies that shape how the product behaves."
        breadcrumbs={[{ label: 'Administration' }, { label: 'School settings' }]}
        actions={
          <Button data-cy="settings-school-settings-save-changes" onClick={() => void save()} loading={update.isPending} disabled={!dirty}>
            <Save />
            Save changes
          </Button>
        }
      />

      <SettingsTabs />

      <FormError error={update.error} />

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="School name" required>
            <Input
              data-cy="school-settings-name"
              value={draft.name ?? ''}
              onChange={(event) => set({ name: event.target.value })}
            />
          </Field>
          <Field label="Short name" hint="Used in the sidebar and on documents.">
            <Input
              data-cy="school-settings-short-name"
              value={draft.shortName ?? ''}
              onChange={(event) => set({ shortName: event.target.value })}
            />
          </Field>
          <Field label="School code" hint="Prefixes verification codes.">
            <Input
              data-cy="school-settings-code"
              value={draft.code ?? ''}
              onChange={(event) => set({ code: event.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Website">
            <Input
              data-cy="school-settings-website"
              type="url"
              value={draft.website ?? ''}
              onChange={(event) => set({ website: event.target.value })}
              placeholder="https://"
            />
          </Field>
          <Field label="Email" required>
            <Input
              data-cy="school-settings-email"
              type="email"
              value={draft.email ?? ''}
              onChange={(event) => set({ email: event.target.value })}
            />
          </Field>
          <Field label="Phone" required>
            <Input
              data-cy="school-settings-phone"
              type="tel"
              value={draft.phone ?? ''}
              onChange={(event) => set({ phone: event.target.value })}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input
              data-cy="school-settings-address-line1"
              value={draft.addressLine1 ?? ''}
              onChange={(event) => set({ addressLine1: event.target.value })}
            />
          </Field>
          <Field label="City">
            <Input
              data-cy="school-settings-city"
              value={draft.city ?? ''}
              onChange={(event) => set({ city: event.target.value })}
            />
          </Field>
          <Field label="State">
            <Input
              data-cy="school-settings-state"
              value={draft.state ?? ''}
              onChange={(event) => set({ state: event.target.value })}
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
          <Field label="Country">
            <Input
              data-cy="school-settings-country"
              value={draft.settings?.country ?? ''}
              onChange={(event) => setSettings({ country: event.target.value })}
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
            onChange={(value) => setSettings({ requirePhotoConsent: value })}
          />
          <Toggle
            label="Same-day absence alerts"
            description="Notify a guardian the first time their child is marked absent without explanation."
            checked={draft.settings?.absenceAlertEnabled ?? true}
            onChange={(value) => setSettings({ absenceAlertEnabled: value })}
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
            onChange={(value) => setSettings({ resultPublishNotification: value })}
          />
          <Toggle
            label="Allow parent–teacher messaging"
            description="Parents can start a conversation with staff connected to their own children."
            checked={draft.settings?.allowParentTeacherMessaging ?? true}
            onChange={(value) => setSettings({ allowParentTeacherMessaging: value })}
          />
          <Toggle
            label="Public website"
            description="Publishes a school profile at a public address, built from the Website settings."
            checked={draft.settings?.publicWebsiteEnabled ?? false}
            onChange={(value) => setSettings({ publicWebsiteEnabled: value })}
          />

          {draft.settings?.requirePhotoConsent === false && (
            <Alert tone="warning" title="Photo consent is off">
              Student photographs may then appear on public pages and printed documents. Make sure
              this matches the permission your families have actually given.
            </Alert>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
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
