import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import {
  BLOOD_GROUP_OPTIONS,
  NATIONALITY_OPTIONS,
  RELIGION_OPTIONS,
  statesOfNationality,
  withStoredValue,
} from '@/lib/demographics';

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
  nationality: 'Nigeria',
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

  const photoUrl = form.watch('photoUrl');
  const photoConsent = form.watch('photoConsent');
  const nationality = form.watch('nationality');
  const stateOfOrigin = form.watch('stateOfOrigin');
  const religion = form.watch('religion');
  const bloodGroup = form.watch('bloodGroup');
  const stateOptions = statesOfNationality(nationality);

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

      {isEdit && existing.isPending ? (
        <LoadingState label="Loading student…" />
      ) : (
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
                hint={
                  classOptions.length === 0 ? (
                    <>
                      No classes yet.{' '}
                      <Link to="/settings/academics" className="text-primary hover:underline">
                        Create one in Academics settings
                      </Link>
                      .
                    </>
                  ) : undefined
                }
              />
              <SelectField
                control={form.control}
                name="houseId"
                label="House"
                options={houseOptions}
                placeholder="No house"
                native
                hint={
                  houseOptions.length === 0 ? (
                    <>
                      No houses yet.{' '}
                      <Link to="/settings/academics" className="text-primary hover:underline">
                        Create one in Academics settings
                      </Link>
                      .
                    </>
                  ) : undefined
                }
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
              <SelectField
                control={form.control}
                name="nationality"
                label="Nationality"
                options={withStoredValue(NATIONALITY_OPTIONS, nationality)}
                placeholder="Select a nationality"
                // The state list below belongs to this country, so the old
                // state cannot stand once the country changes.
                onValueChange={() => form.setValue('stateOfOrigin', '', { shouldDirty: true })}
              />
              {stateOptions.length > 0 ? (
                <SelectField
                  control={form.control}
                  name="stateOfOrigin"
                  label="State of origin"
                  options={withStoredValue(stateOptions, stateOfOrigin)}
                  placeholder="Select a state"
                />
              ) : (
                // Not every country has states in the dataset, and nationality
                // may not be filled in yet. Typing beats an empty list.
                <TextField
                  control={form.control}
                  name="stateOfOrigin"
                  label="State of origin"
                  hint={!nationality ? 'Pick a nationality to choose from a list.' : undefined}
                />
              )}
              <SelectField
                control={form.control}
                name="religion"
                label="Religion"
                options={withStoredValue(RELIGION_OPTIONS, religion)}
                placeholder="Select a religion"
              />
              <SelectField
                control={form.control}
                name="bloodGroup"
                label="Blood group"
                options={withStoredValue(BLOOD_GROUP_OPTIONS, bloodGroup)}
                placeholder="Select a blood group"
              />
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
      )}
    </PageContainer>
  );
}
