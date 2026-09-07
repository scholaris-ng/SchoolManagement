import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { toDateInputValue } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import { useLevelOptions, useSessionOptions } from '@/features/academics/api';
import { useCreateAdmission } from './api';
import { admissionFormSchema, type AdmissionFormValues } from './schema';
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
import { Button } from '@/components/ui/button';

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];

const RELATIONSHIP_OPTIONS = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'OTHER', label: 'Other' },
];

const emptyGuardian = {
  title: '',
  firstName: '',
  lastName: '',
  relationship: 'MOTHER' as const,
  email: '',
  phone: '',
  occupation: '',
  address: '',
  isPrimaryContact: false,
};

/**
 * Entering an application on someone's behalf — a walk-in at the office, or a
 * paper form typed up later. The same shape a public application form submits,
 * so both paths converge on one workflow.
 */
export function AdmissionFormPage() {
  const navigate = useNavigate();
  const createAdmission = useCreateAdmission();
  const sessionOptions = useSessionOptions();
  const levelOptions = useLevelOptions();

  const form = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionFormSchema),
    defaultValues: {
      sessionId: '',
      levelId: '',
      applicant: {
        firstName: '',
        middleName: '',
        lastName: '',
        gender: 'MALE',
        dateOfBirth: '',
        photoUrl: null,
        nationality: 'Nigerian',
        stateOfOrigin: '',
        address: '',
        previousSchool: '',
        bloodGroup: '',
        medicalNotes: '',
      },
      guardians: [{ ...emptyGuardian, isPrimaryContact: true }],
    },
  });

  const guardians = useFieldArray({ control: form.control, name: 'guardians' });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const application = await createAdmission.mutateAsync(values);
      navigate(`/admissions/${application.id}`);
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          form.setError(field as never, { message });
        }
      }
    }
  });

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="New application"
        description="Record an application taken at the office. Documents can be attached once it exists."
        breadcrumbs={[
          { label: 'Admissions', to: '/admissions' },
          { label: 'New application' },
        ]}
      />

      <form onSubmit={onSubmit} noValidate>
        <UnsavedChangesGuard when={form.formState.isDirty && !createAdmission.isPending} />

        <Card>
          <CardContent className="space-y-8 pt-5">
            <FormError error={createAdmission.error} />

            <FormSection title="Applying for" columns={2}>
              <SelectField
                control={form.control}
                name="sessionId"
                label="Academic session"
                required
                options={sessionOptions}
                placeholder="Select a session"
                native
              />
              <SelectField
                control={form.control}
                name="levelId"
                label="Level"
                required
                options={levelOptions}
                placeholder="Select a level"
                native
              />
            </FormSection>

            <FormSection title="The child" columns={2}>
              <TextField
                control={form.control}
                name="applicant.firstName"
                label="First name"
                required
              />
              <TextField control={form.control} name="applicant.middleName" label="Middle name" />
              <TextField control={form.control} name="applicant.lastName" label="Surname" required />
              <SelectField
                control={form.control}
                name="applicant.gender"
                label="Gender"
                required
                options={GENDER_OPTIONS}
                native
              />
              <DateField
                control={form.control}
                name="applicant.dateOfBirth"
                label="Date of birth"
                required
                max={toDateInputValue(new Date())}
              />
              <TextField
                control={form.control}
                name="applicant.previousSchool"
                label="Previous school"
              />
              <TextField control={form.control} name="applicant.nationality" label="Nationality" />
              <TextField
                control={form.control}
                name="applicant.stateOfOrigin"
                label="State of origin"
              />
              <TextareaField
                control={form.control}
                name="applicant.address"
                label="Home address"
                rows={2}
                className="sm:col-span-2"
              />
              <TextField control={form.control} name="applicant.bloodGroup" label="Blood group" />
              <TextareaField
                control={form.control}
                name="applicant.medicalNotes"
                label="Medical notes"
                rows={2}
                className="sm:col-span-2"
                description="Anything the school must know if the child is offered a place."
              />
            </FormSection>

            <FormSection
              title="Parents and guardians"
              description="At least one. The primary contact receives the admission decision and, later, portal access."
              columns={1}
            >
              <div className="space-y-4">
                {guardians.fields.map((field, index) => (
                  <div key={field.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">Guardian {index + 1}</p>
                      {guardians.fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => guardians.remove(index)}
                        >
                          <Trash2 />
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        control={form.control}
                        name={`guardians.${index}.firstName`}
                        label="First name"
                        required
                      />
                      <TextField
                        control={form.control}
                        name={`guardians.${index}.lastName`}
                        label="Surname"
                        required
                      />
                      <SelectField
                        control={form.control}
                        name={`guardians.${index}.relationship`}
                        label="Relationship"
                        required
                        options={RELATIONSHIP_OPTIONS}
                        native
                      />
                      <TextField
                        control={form.control}
                        name={`guardians.${index}.occupation`}
                        label="Occupation"
                      />
                      <TextField
                        control={form.control}
                        name={`guardians.${index}.email`}
                        label="Email"
                        type="email"
                        required
                      />
                      <TextField
                        control={form.control}
                        name={`guardians.${index}.phone`}
                        label="Phone"
                        type="tel"
                        required
                      />
                      <CheckboxField
                        control={form.control}
                        name={`guardians.${index}.isPrimaryContact`}
                        label="Primary contact"
                        description="Receives the decision and is billed for fees."
                        className="sm:col-span-2"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => guardians.append({ ...emptyGuardian })}
                >
                  <Plus />
                  Add another guardian
                </Button>

                {form.formState.errors.guardians?.message && (
                  <p role="alert" className="text-xs text-danger">
                    {form.formState.errors.guardians.message}
                  </p>
                )}
              </div>
            </FormSection>
          </CardContent>

          <FormActions
            onCancel={() => navigate('/admissions')}
            submitLabel="Create application"
            loading={createAdmission.isPending}
            dirty={form.formState.isDirty}
          />
        </Card>
      </form>
    </PageContainer>
  );
}
