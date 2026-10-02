import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isApiError } from '@/lib/api-error';
import { useCreateGuardian, useGuardian, useGuardians, useUpdateGuardian } from './api';
import { guardianFormSchema, type GuardianFormValues } from './schema';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { FormActions, FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import { titleOptionsFor } from './titles';
import {
  FormSection,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/forms/form-field';
import { Alert, LoadingState } from '@/components/ui/feedback';

/** Digits only, so "070-1234 5678" and "07012345678" compare equal. */
function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

const emptyValues: GuardianFormValues = {
  title: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  altPhone: '',
  occupation: '',
  address: '',
  grantPortalAccess: false,
};

export function GuardianFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const existing = useGuardian(id);
  const createGuardian = useCreateGuardian();
  const updateGuardian = useUpdateGuardian(id ?? '');
  const mutation = isEdit ? updateGuardian : createGuardian;

  // The same list "Link a guardian" already searches — reused here to warn
  // before a mistake, not after: an email clash is refused on submit anyway,
  // but a shared phone number isn't, and is just as often two parents who
  // are already the same person in this school's records as it is a
  // household landline two different guardians happen to share.
  const guardians = useGuardians({ page: 1, pageSize: 200, sortBy: 'fullName' });

  const form = useForm<GuardianFormValues>({
    resolver: zodResolver(guardianFormSchema),
    defaultValues: emptyValues,
  });

  const watchedEmail = useWatch({ control: form.control, name: 'email' });
  const watchedPhone = useWatch({ control: form.control, name: 'phone' });

  const possibleDuplicate = useMemo(() => {
    const rows = (guardians.data?.items ?? []).filter((guardian) => guardian.id !== id);
    const email = watchedEmail?.trim().toLowerCase();
    const phone = normalisePhone(watchedPhone ?? '');

    const byEmail = email ? rows.find((guardian) => guardian.email?.toLowerCase() === email) : undefined;
    if (byEmail) return { guardian: byEmail, matchedOn: 'email' as const };

    const byPhone =
      phone.length >= 7 ? rows.find((guardian) => normalisePhone(guardian.phone) === phone) : undefined;
    if (byPhone) return { guardian: byPhone, matchedOn: 'phone' as const };

    return null;
  }, [guardians.data, watchedEmail, watchedPhone, id]);

  useEffect(() => {
    if (!existing.data) return;
    const guardian = existing.data;
    form.reset({
      title: guardian.title ?? '',
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      email: guardian.email ?? '',
      phone: guardian.phone,
      altPhone: guardian.altPhone ?? '',
      occupation: guardian.occupation ?? '',
      address: guardian.address ?? '',
      grantPortalAccess: guardian.hasPortalAccess,
    });
  }, [existing.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        const guardian = await updateGuardian.mutateAsync({
          values,
          version: existing.data?.version ?? 0,
        });
        navigate(`/guardians/${guardian.id}`);
      } else {
        const guardian = await createGuardian.mutateAsync(values);
        navigate(`/guardians/${guardian.id}`);
      }
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          form.setError(field as keyof GuardianFormValues, { message });
        }
      }
    }
  });

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={isEdit ? `Edit ${existing.data?.fullName ?? 'guardian'}` : 'Add a guardian'}
        description="A guardian record is a person, not a relationship — link them to as many children as they are responsible for."
        breadcrumbs={[
          { label: 'Guardians', to: '/guardians' },
          ...(isEdit && existing.data
            ? [{ label: existing.data.fullName, to: `/guardians/${id}` }, { label: 'Edit' }]
            : [{ label: 'New guardian' }]),
        ]}
      />

      {isEdit && existing.isPending ? (
        <LoadingState label="Loading guardian…" />
      ) : (
      <form onSubmit={onSubmit} noValidate>
        <UnsavedChangesGuard when={form.formState.isDirty && !mutation.isPending} />

        <Card>
          <CardContent className="space-y-8 pt-5">
            <FormError error={mutation.error} />

            <FormSection title="Name" columns={2}>
              <SelectField
                control={form.control}
                name="title"
                label="Title"
                options={titleOptionsFor(existing.data?.title)}
                placeholder="No title"
                native
              />
              <TextField control={form.control} name="occupation" label="Occupation" />
              <TextField control={form.control} name="firstName" label="First name" required />
              <TextField control={form.control} name="lastName" label="Surname" required />
            </FormSection>

            <FormSection
              title="Contact"
              description="The email address is optional — only needed if this guardian wants a parent-portal account, now or later."
              columns={2}
            >
              <TextField
                control={form.control}
                name="email"
                label="Email address"
                type="email"
                autoComplete="email"
              />
              <TextField
                control={form.control}
                name="phone"
                label="Phone number"
                type="tel"
                required
              />
              <TextField control={form.control} name="altPhone" label="Alternative phone" type="tel" />
              <TextareaField
                control={form.control}
                name="address"
                label="Home address"
                rows={2}
                className="sm:col-span-2"
              />
            </FormSection>

            {possibleDuplicate && (
              <Alert
                tone="warning"
                title={
                  possibleDuplicate.matchedOn === 'email'
                    ? 'Already a guardian with this email'
                    : 'Already a guardian with this phone number'
                }
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    data-cy="guardian-form-duplicate-link"
                  >
                    <Link to={`/guardians/${possibleDuplicate.guardian.id}`}>
                      Open {possibleDuplicate.guardian.fullName}
                    </Link>
                  </Button>
                }
              >
                {possibleDuplicate.guardian.fullName} is already on record
                {possibleDuplicate.guardian.studentCount > 0
                  ? ` for ${possibleDuplicate.guardian.studentCount} ${possibleDuplicate.guardian.studentCount === 1 ? 'child' : 'children'}`
                  : ''}
                . If this is the same person, cancel here — their own page has a "Link a student"
                button to attach this child instead of creating a second record.{' '}
                {possibleDuplicate.matchedOn === 'email'
                  ? 'An email address can only belong to one guardian record.'
                  : "A shared phone number isn't always the same person, so this is only a check."}
              </Alert>
            )}

            <FormSection title="Parent portal" columns={1}>
              <SwitchField
                control={form.control}
                name="grantPortalAccess"
                label="Invite this guardian to the parent portal"
                description="They receive an email to set their own password. One sign-in shows every child linked to them, at this school. Needs an email address above — leave this off if they don't want an account yet; it can always be turned on later from their profile."
              />
            </FormSection>
          </CardContent>

          <FormActions
            onCancel={() => navigate(isEdit ? `/guardians/${id}` : '/guardians')}
            submitLabel={isEdit ? 'Save changes' : 'Add guardian'}
            loading={mutation.isPending}
            dirty={form.formState.isDirty}
          />
        </Card>
      </form>
      )}
    </PageContainer>
  );
}
