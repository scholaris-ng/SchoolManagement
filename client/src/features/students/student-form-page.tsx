import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toDateInputValue } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import { useClassOptions, useHouseOptions } from '@/features/academics/api';
import { useCreateStudent, useStudent, useUpdateStudent } from './api';
import { studentFormSchema, type StudentFormValues } from './schema';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { FormActions, FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import {
  CheckboxField,
  DateField,
  FormSection,
  SelectField,
  TextField,
  TextareaField,
} from '@/components/forms/form-field';
import { FileUpload } from '@/components/forms/file-upload';
import { Alert, LoadingState } from '@/components/ui/feedback';

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];

const emptyValues: StudentFormValues = {
  admissionNo: '',
  firstName: '',
  middleName: '',
  lastName: '',
  gender: 'MALE',
  dateOfBirth: '',
  admissionDate: toDateInputValue(new Date()),
  currentClassId: '',
  houseId: '',
  photoUrl: null,
  photoStoragePath: null,
  photoConsent: false,
  bloodGroup: '',
  medicalNotes: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  address: '',
  nationality: 'Nigerian',
  stateOfOrigin: '',
  religion: '',
};

/** Create and edit share one form; only the submit behaviour differs. */
export function StudentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const existing = useStudent(id);
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent(id ?? '');

  const classOptions = useClassOptions();
  const houseOptions = useHouseOptions();

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!existing.data) return;
    const student = existing.data;
    form.reset({
      admissionNo: student.admissionNo,
      firstName: student.firstName,
      middleName: student.middleName ?? '',
      lastName: student.lastName,
      gender: student.gender,
      dateOfBirth: toDateInputValue(student.dateOfBirth),
      admissionDate: toDateInputValue(student.admissionDate),
      currentClassId: student.currentClassId ?? '',
      houseId: student.houseId ?? '',
      photoUrl: student.photoUrl ?? null,
      photoStoragePath: null,
      photoConsent: student.photoConsent,
      bloodGroup: student.bloodGroup ?? '',
      medicalNotes: student.medicalNotes ?? '',
      emergencyContactName: student.emergencyContactName ?? '',
      emergencyContactPhone: student.emergencyContactPhone ?? '',
      address: student.address ?? '',
      nationality: student.nationality ?? '',
      stateOfOrigin: student.stateOfOrigin ?? '',
      religion: student.religion ?? '',
    });
  }, [existing.data, form]);

  const mutation = isEdit ? updateStudent : createStudent;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        const student = await updateStudent.mutateAsync({
          values,
          version: existing.data?.version ?? 0,
        });
        form.reset(form.getValues(), { keepValues: true });
        navigate(`/students/${student.id}`);
      } else {
        const student = await createStudent.mutateAsync(values);
        navigate(`/students/${student.id}`);
      }
    } catch (error) {
      // Field-level messages from the API are pushed back onto the matching
      // inputs so the user is taken straight to what needs fixing.
      if (isApiError(error) && error.isValidation) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          form.setError(field as keyof StudentFormValues, { message });
        }
      }
    }
  });

  if (isEdit && existing.isPending) {
    return (
      <PageContainer width="narrow">
        <LoadingState label="Loading student…" />
      </PageContainer>
    );
  }

  const photoUrl = form.watch('photoUrl');
  const photoConsent = form.watch('photoConsent');

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={isEdit ? `Edit ${existing.data?.fullName ?? 'student'}` : 'Add a student'}
        description={
          isEdit
            ? 'Changes are recorded in the audit trail.'
            : 'Register a child on the school roll. You can add guardians once the record exists.'
        }
        breadcrumbs={[
          { label: 'Students', to: '/students' },
          ...(isEdit && existing.data
            ? [{ label: existing.data.fullName, to: `/students/${id}` }, { label: 'Edit' }]
            : [{ label: 'New student' }]),
        ]}
      />

      <form onSubmit={onSubmit} noValidate>
        <UnsavedChangesGuard when={form.formState.isDirty && !mutation.isPending} />

        <Card>
          <CardContent className="space-y-8 pt-5">
            <FormError error={mutation.error} />

            <FormSection title="Identity" columns={2}>
              <TextField
                control={form.control}
                name="admissionNo"
                label="Admission number"
                required
                placeholder="e.g. SCH/2026/0142"
                hint="Must be unique within this school."
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
              <TextField control={form.control} name="middleName" label="Middle name" />
              <TextField control={form.control} name="lastName" label="Surname" required />
              <DateField
                control={form.control}
                name="dateOfBirth"
                label="Date of birth"
                required
                max={toDateInputValue(new Date())}
              />
            </FormSection>

            <FormSection title="Photograph" columns={1}>
              <div className="space-y-4">
                <FileUpload
                  variant="avatar"
                  preset="image"
                  purpose="student-photo"
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
                <CheckboxField
                  control={form.control}
                  name="photoConsent"
                  label="A guardian has consented to this photograph being used"
                  description="Without consent the photo is used only inside the school portal — never on the public website, the news feed or printed documents."
                />
                {photoUrl && !photoConsent && (
                  <Alert tone="warning" title="Photo consent not recorded">
                    This photograph will be hidden everywhere a child's image could be seen
                    publicly until consent is recorded.
                  </Alert>
                )}
              </div>
            </FormSection>

            <FormSection title="Placement" columns={2}>
              <SelectField
                control={form.control}
                name="currentClassId"
                label="Class"
                required
                options={classOptions}
                placeholder="Select a class"
                native
              />
              <SelectField
                control={form.control}
                name="houseId"
                label="House"
                options={houseOptions}
                placeholder="No house"
                native
              />
              <DateField
                control={form.control}
                name="admissionDate"
                label="Admission date"
                required
                max={toDateInputValue(new Date())}
              />
            </FormSection>

            <FormSection title="Background" columns={2}>
              <TextField control={form.control} name="nationality" label="Nationality" />
              <TextField control={form.control} name="stateOfOrigin" label="State of origin" />
              <TextField control={form.control} name="religion" label="Religion" />
              <TextField control={form.control} name="bloodGroup" label="Blood group" placeholder="e.g. O+" />
              <TextareaField
                control={form.control}
                name="address"
                label="Home address"
                rows={2}
                className="sm:col-span-2"
              />
            </FormSection>

            <FormSection title="Health and emergency" columns={2}>
              <TextField
                control={form.control}
                name="emergencyContactName"
                label="Emergency contact name"
              />
              <TextField
                control={form.control}
                name="emergencyContactPhone"
                label="Emergency contact phone"
                type="tel"
              />
              <TextareaField
                control={form.control}
                name="medicalNotes"
                label="Medical notes"
                rows={3}
                maxLength={2000}
                className="sm:col-span-2"
                description="Allergies, conditions or medication the school must know about. Visible only to staff with student access."
              />
            </FormSection>
          </CardContent>

          <FormActions
            onCancel={() => navigate(isEdit ? `/students/${id}` : '/students')}
            submitLabel={isEdit ? 'Save changes' : 'Add student'}
            loading={mutation.isPending}
            dirty={form.formState.isDirty}
          />
        </Card>
      </form>
    </PageContainer>
  );
}
