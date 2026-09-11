import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toDateInputValue } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import { ROLES, ROLE_LABEL } from '@/types/rbac';
import { useClassOptions, useSubjectOptions } from '@/features/academics/api';
import { useSchool } from '@/features/settings/api';
import { useCreateStaff, useStaffMember, useUpdateStaff } from './api';
import { staffFormSchema, type StaffFormValues } from './schema';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { FormActions, FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import {
  DateField,
  FormSection,
  MultiSelectField,
  PhoneField,
  SelectField,
  SwitchField,
  TextField,
} from '@/components/forms/form-field';
import { FileUpload } from '@/components/forms/file-upload';
import { NewStaffCredentialsDialog, type NewStaffCredentials } from './new-staff-credentials-dialog';
import { Alert, LoadingState } from '@/components/ui/feedback';

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'EXITED', label: 'Exited' },
];

/** Roles a school can hand out here; platform operators are provisioned elsewhere. */
const ASSIGNABLE_ROLES = ROLES.filter(
  (role) => role !== 'SUPER_ADMIN' && role !== 'PARENT' && role !== 'STUDENT',
);

const emptyValues: StaffFormValues = {
  staffNo: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  gender: 'FEMALE',
  designation: '',
  department: '',
  employmentType: 'FULL_TIME',
  employmentDate: toDateInputValue(new Date()),
  status: 'ACTIVE',
  photoUrl: null,
  photoStoragePath: null,
  roleNames: ['TEACHER'],
  subjectIds: [],
  classIds: [],
  isFormTeacher: false,
};

export function StaffFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const existing = useStaffMember(id);
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff(id ?? '');
  const mutation = isEdit ? updateStaff : createStaff;

  const subjectOptions = useSubjectOptions();
  const classOptions = useClassOptions();
  const school = useSchool();

  const [newCredentials, setNewCredentials] = useState<NewStaffCredentials | null>(null);
  const [createdStaffId, setCreatedStaffId] = useState<string | null>(null);

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!existing.data) return;
    const member = existing.data;
    form.reset({
      staffNo: member.staffNo,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone,
      gender: member.gender,
      designation: member.designation,
      department: member.department ?? '',
      employmentType: member.employmentType,
      employmentDate: toDateInputValue(member.employmentDate),
      status: member.status,
      photoUrl: member.photoUrl ?? null,
      photoStoragePath: null,
      roleNames: member.roleNames as StaffFormValues['roleNames'],
      subjectIds: member.subjectIds,
      classIds: member.classIds,
      isFormTeacher: member.isFormTeacher,
    });
  }, [existing.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        const member = await updateStaff.mutateAsync({
          values,
          version: existing.data?.version ?? 0,
        });
        navigate(`/staff/${member.id}`);
      } else {
        const member = await createStaff.mutateAsync(values);
        // Otherwise the unsaved-changes guard reads the form as still dirty
        // and blocks the very navigation the "continue" button below asks for.
        form.reset(values, { keepValues: true });
        // The password only ever comes back on this one response, so it is
        // shown before moving on rather than after — there is no later screen
        // that could still offer it.
        setCreatedStaffId(member.id);
        setNewCredentials({
          fullName: member.fullName,
          email: member.email,
          temporaryPassword: member.temporaryPassword,
        });
      }
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          form.setError(field as keyof StaffFormValues, { message });
        }
      }
    }
  });

  const photoUrl = form.watch('photoUrl');
  const isFormTeacher = form.watch('isFormTeacher');
  const classIds = form.watch('classIds');

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={isEdit ? `Edit ${existing.data?.fullName ?? 'staff member'}` : 'Add a staff member'}
        description="Roles decide what this person can do. Changing them is recorded in the audit trail."
        breadcrumbs={[
          { label: 'Staff', to: '/staff' },
          ...(isEdit && existing.data
            ? [{ label: existing.data.fullName, to: `/staff/${id}` }, { label: 'Edit' }]
            : [{ label: 'New staff member' }]),
        ]}
      />

      {isEdit && existing.isPending ? (
        <LoadingState label="Loading staff record…" />
      ) : (
      <form onSubmit={onSubmit} noValidate>
        <UnsavedChangesGuard when={form.formState.isDirty && !mutation.isPending} />

        <Card>
          <CardContent className="space-y-8 pt-5">
            <FormError error={mutation.error} />

            <FormSection title="Identity" columns={2}>
              <TextField
                control={form.control}
                name="staffNo"
                label="Staff number"
                required
                hint="Unique within this school."
              />
              <SelectField
                control={form.control}
                name="gender"
                label="Gender"
                required
                options={GENDER_OPTIONS}
                native
              />
              <TextField control={form.control} name="firstName" label="First name" required />
              <TextField control={form.control} name="lastName" label="Surname" required />
              <TextField
                control={form.control}
                name="email"
                label="Work email"
                type="email"
                required
                hint="Used to sign in."
              />
              <PhoneField
                control={form.control}
                name="phone"
                label="Phone"
                required
                defaultCountry={school.data?.settings.country}
              />
            </FormSection>

            <FormSection title="Photograph" columns={1}>
              <FileUpload
                variant="avatar"
                preset="image"
                purpose="staff-photo"
                entityId={id}
                value={photoUrl ? { url: photoUrl } : null}
                onUploaded={(file) => {
                  form.setValue('photoUrl', file.downloadUrl, { shouldDirty: true });
                  form.setValue('photoStoragePath', file.storagePath, { shouldDirty: true });
                }}
                onRemove={() => {
                  form.setValue('photoUrl', null, { shouldDirty: true });
                  form.setValue('photoStoragePath', null, { shouldDirty: true });
                }}
              />
            </FormSection>

            <FormSection title="Employment" columns={2}>
              <TextField
                control={form.control}
                name="designation"
                label="Designation"
                required
                placeholder="e.g. Mathematics teacher"
              />
              <TextField
                control={form.control}
                name="department"
                label="Department"
                placeholder="e.g. Sciences"
              />
              <SelectField
                control={form.control}
                name="employmentType"
                label="Employment type"
                required
                options={EMPLOYMENT_OPTIONS}
                native
              />
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                required
                options={STATUS_OPTIONS}
                native
              />
              <DateField
                control={form.control}
                name="employmentDate"
                label="Employment date"
                required
              />
            </FormSection>

            <FormSection
              title="Access"
              description="Roles are converted to permissions on the server. Give the narrowest set that lets someone do their job."
              columns={1}
            >
              <MultiSelectField
                control={form.control}
                name="roleNames"
                label="Roles"
                required
                options={ASSIGNABLE_ROLES.map((role) => ({
                  value: role,
                  label: ROLE_LABEL[role],
                }))}
              />
            </FormSection>

            <FormSection title="Teaching assignment" columns={1}>
              <MultiSelectField
                control={form.control}
                name="subjectIds"
                label="Subjects taught"
                options={subjectOptions}
                emptyLabel="No subjects defined yet — add them under Academic setup."
              />
              <MultiSelectField
                control={form.control}
                name="classIds"
                label="Classes taught"
                options={classOptions}
                emptyLabel="No classes defined yet — add them under Academic setup."
              />
              <SwitchField
                control={form.control}
                name="isFormTeacher"
                label="Form teacher"
                description="Form teachers write report-card comments and can release children to authorised adults."
              />
              {isFormTeacher && classIds.length === 0 && (
                <Alert tone="warning" title="No class selected">
                  A form teacher needs at least one class, otherwise there is no register for them
                  to take.
                </Alert>
              )}
            </FormSection>
          </CardContent>

          <FormActions
            onCancel={() => navigate(isEdit ? `/staff/${id}` : '/staff')}
            submitLabel={isEdit ? 'Save changes' : 'Add staff member'}
            loading={mutation.isPending}
            dirty={form.formState.isDirty}
          />
        </Card>
      </form>
      )}

      <NewStaffCredentialsDialog
        credentials={newCredentials}
        onClose={() => {
          setNewCredentials(null);
          if (createdStaffId) navigate(`/staff/${createdStaffId}`);
        }}
      />
    </PageContainer>
  );
}
