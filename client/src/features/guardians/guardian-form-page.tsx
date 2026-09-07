import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { isApiError } from '@/lib/api-error';
import { useCreateGuardian, useGuardian, useUpdateGuardian } from './api';
import { guardianFormSchema, type GuardianFormValues } from './schema';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { FormActions, FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import {
  FormSection,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/forms/form-field';
import { LoadingState } from '@/components/ui/feedback';

const emptyValues: GuardianFormValues = {
  title: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  altPhone: '',
  occupation: '',
  address: '',
  grantPortalAccess: true,
};

export function GuardianFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const existing = useGuardian(id);
  const createGuardian = useCreateGuardian();
  const updateGuardian = useUpdateGuardian(id ?? '');
  const mutation = isEdit ? updateGuardian : createGuardian;

  const form = useForm<GuardianFormValues>({
    resolver: zodResolver(guardianFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!existing.data) return;
    const guardian = existing.data;
    form.reset({
      title: guardian.title ?? '',
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      email: guardian.email,
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

  if (isEdit && existing.isPending) {
    return (
      <PageContainer width="narrow">
        <LoadingState label="Loading guardian…" />
      </PageContainer>
    );
  }

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

      <form onSubmit={onSubmit} noValidate>
        <UnsavedChangesGuard when={form.formState.isDirty && !mutation.isPending} />

        <Card>
          <CardContent className="space-y-8 pt-5">
            <FormError error={mutation.error} />

            <FormSection title="Name" columns={2}>
              <TextField
                control={form.control}
                name="title"
                label="Title"
                placeholder="Mr, Mrs, Dr…"
              />
              <TextField control={form.control} name="occupation" label="Occupation" />
              <TextField control={form.control} name="firstName" label="First name" required />
              <TextField control={form.control} name="lastName" label="Surname" required />
            </FormSection>

            <FormSection
              title="Contact"
              description="The email address is what they will sign in with, so it must be one they actually use."
              columns={2}
            >
              <TextField
                control={form.control}
                name="email"
                label="Email address"
                type="email"
                required
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

            <FormSection title="Parent portal" columns={1}>
              <SwitchField
                control={form.control}
                name="grantPortalAccess"
                label="Invite this guardian to the parent portal"
                description="They receive an email to set their own password. One sign-in shows every child linked to them, at this school."
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
    </PageContainer>
  );
}
