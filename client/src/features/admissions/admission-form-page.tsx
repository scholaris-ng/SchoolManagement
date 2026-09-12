import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { toDateInputValue } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import {
  BLOOD_GROUP_OPTIONS,
  NATIONALITY_OPTIONS,
  NIGERIA_STATE_OPTIONS,
  citiesOfNigeriaState,
  statesOfNationality,
} from '@/lib/demographics';
import { useClassOptions, useSessionOptions } from '@/features/academics/api';
import { useCreateAdmission } from './api';
import {
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  admissionFormSchema,
  type AdmissionFormValues,
} from './schema';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { FormActions, FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import {
  CheckboxField,
  DateField,
  FormSection,
  RadioCardField,
  SelectField,
  TextField,
  TextareaField,
} from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';

const APPLICANT_TYPE_OPTIONS = [
  {
    value: 'GUARDIAN',
    label: 'A parent or guardian is applying',
    description: 'For a child. The school writes to the parent about the decision.',
  },
  {
    value: 'SELF',
    label: 'The applicant is applying for themselves',
    description: 'An older student. The school writes to them, and still needs a next of kin.',
  },
];

const emptyContact = {
  title: '',
  firstName: '',
  lastName: '',
  relationship: 'MOTHER' as const,
  email: '',
  phone: '',
  occupation: '',
  address: '',
  city: '',
  state: '',
  isPrimaryContact: false,
};

/**
 * Entering an application on someone's behalf — a walk-in at the office, or a
 * paper form typed up later.
 *
 * The same shape the public website submits, down to the applicant-type
 * question at the top, so both paths converge on one record and one workflow.
 * Whichever is chosen, the people named here are held on the application and
 * are not guardian records: enrolling the child is what creates those.
 */
export function AdmissionFormPage() {
  const navigate = useNavigate();
  const createAdmission = useCreateAdmission();
  const sessionOptions = useSessionOptions();
  const classOptions = useClassOptions();

  const form = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionFormSchema),
    defaultValues: {
      applicantType: 'GUARDIAN',
      sessionId: '',
      classId: '',
      applicant: {
        firstName: '',
        middleName: '',
        lastName: '',
        gender: 'MALE',
        dateOfBirth: '',
        photoUrl: null,
        nationality: 'Nigeria',
        stateOfOrigin: '',
        address: '',
        city: '',
        state: '',
        previousSchool: '',
        previousClass: '',
        bloodGroup: '',
        medicalNotes: '',
        email: '',
        phone: '',
      },
      contacts: [{ ...emptyContact, isPrimaryContact: true }],
    },
  });

  const contacts = useFieldArray({ control: form.control, name: 'contacts' });
  const applicantType = useWatch({ control: form.control, name: 'applicantType' });
  const isSelf = applicantType === 'SELF';

  // City belongs to whichever state was picked, for the applicant and for
  // each contact — `watchedContacts` follows the whole array so a list keyed
  // by index stays live as rows are added, removed or edited.
  const applicantState = useWatch({ control: form.control, name: 'applicant.state' });
  const applicantCityOptions = citiesOfNigeriaState(applicantState);
  const applicantNationality = useWatch({ control: form.control, name: 'applicant.nationality' });
  const applicantStateOfOriginOptions = statesOfNationality(applicantNationality);
  const watchedContacts = useWatch({ control: form.control, name: 'contacts' });

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

            <FormSection
              title="Who is applying"
              description="This decides who the school corresponds with, and what the form asks for."
              columns={1}
            >
              <RadioCardField
                control={form.control}
                name="applicantType"
                label="Application filed by"
                required
                options={APPLICANT_TYPE_OPTIONS}
              />
            </FormSection>

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
                name="classId"
                label="Class"
                required
                options={classOptions}
                placeholder="Select a class"
                native
              />
            </FormSection>

            <FormSection title={isSelf ? 'The applicant' : 'The child'} columns={2}>
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
                options={[...GENDER_OPTIONS]}
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
              <TextField
                control={form.control}
                name="applicant.previousClass"
                label="Previous class"
                description="The class they are leaving, where they have been in school before."
              />
              <SelectField
                control={form.control}
                name="applicant.nationality"
                label="Nationality"
                options={NATIONALITY_OPTIONS}
                placeholder="Select a nationality"
                native
                // The state list below belongs to this country, so the old
                // state cannot stand once it changes.
                onValueChange={() =>
                  form.setValue('applicant.stateOfOrigin', '', { shouldDirty: true })
                }
              />
              {applicantStateOfOriginOptions.length > 0 ? (
                <SelectField
                  control={form.control}
                  name="applicant.stateOfOrigin"
                  label="State of origin"
                  options={applicantStateOfOriginOptions}
                  placeholder="Select a state"
                  native
                />
              ) : (
                <TextField
                  control={form.control}
                  name="applicant.stateOfOrigin"
                  label="State of origin"
                  hint={
                    !applicantNationality ? 'Pick a nationality to choose from a list.' : undefined
                  }
                />
              )}
              <TextareaField
                control={form.control}
                name="applicant.address"
                label="Home address"
                rows={2}
                className="sm:col-span-2"
              />
              <SelectField
                control={form.control}
                name="applicant.state"
                label="State"
                options={NIGERIA_STATE_OPTIONS}
                placeholder="Select a state"
                native
                // The city list below belongs to this state, so a city picked
                // under the old one cannot stand once it changes.
                onValueChange={() => form.setValue('applicant.city', '', { shouldDirty: true })}
              />
              {applicantCityOptions.length > 0 ? (
                <SelectField
                  control={form.control}
                  name="applicant.city"
                  label="City"
                  options={applicantCityOptions}
                  placeholder="Select a city"
                  native
                />
              ) : (
                <TextField
                  control={form.control}
                  name="applicant.city"
                  label="City"
                  hint={!applicantState ? 'Pick a state to choose from a list.' : undefined}
                />
              )}
              <SelectField
                control={form.control}
                name="applicant.bloodGroup"
                label="Blood group"
                options={BLOOD_GROUP_OPTIONS}
                placeholder="Select a blood group"
                native
              />
              <TextareaField
                control={form.control}
                name="applicant.medicalNotes"
                label="Medical notes"
                rows={2}
                className="sm:col-span-2"
                description="Anything the school must know if the applicant is offered a place."
              />

              {/* Only an applicant applying for themselves is written to
                  directly. On a parent-filed application these would end up
                  holding the parent's details on the child's record. */}
              {isSelf && (
                <>
                  <TextField
                    control={form.control}
                    name="applicant.email"
                    label="Their email"
                    type="email"
                    required
                  />
                  <TextField
                    control={form.control}
                    name="applicant.phone"
                    label="Their phone"
                    type="tel"
                    required
                  />
                </>
              )}
            </FormSection>

            <FormSection
              title={isSelf ? 'Parent, guardian or next of kin' : 'Parents and guardians'}
              description={
                isSelf
                  ? 'At least one adult the school can reach about this application.'
                  : 'At least one. The primary contact receives the admission decision.'
              }
              columns={1}
            >
              <Alert tone="info" title="Held with the application, not the parent register">
                Nobody added here becomes a guardian record, gets portal access or is billed for
                fees. That happens when the applicant is offered a place, accepts it and is
                enrolled.
              </Alert>

              <div className="space-y-4">
                {contacts.fields.map((field, index) => {
                  const contactState = watchedContacts?.[index]?.state;
                  const contactCityOptions = citiesOfNigeriaState(contactState);

                  return (
                    <div key={field.id} className="rounded-lg border border-border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium">Contact {index + 1}</p>
                        {contacts.fields.length > 1 && (
                          <Button
                            data-cy="admissions-admission-form-remove"
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => contacts.remove(index)}
                          >
                            <Trash2 />
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                          control={form.control}
                          name={`contacts.${index}.firstName`}
                          label="First name"
                          required
                        />
                        <TextField
                          control={form.control}
                          name={`contacts.${index}.lastName`}
                          label="Surname"
                          required
                        />
                        <SelectField
                          control={form.control}
                          name={`contacts.${index}.relationship`}
                          label="Relationship"
                          required
                          options={[...RELATIONSHIP_OPTIONS]}
                          native
                        />
                        <TextField
                          control={form.control}
                          name={`contacts.${index}.occupation`}
                          label="Occupation"
                        />
                        <TextField
                          control={form.control}
                          name={`contacts.${index}.email`}
                          label="Email"
                          type="email"
                          required
                        />
                        <TextField
                          control={form.control}
                          name={`contacts.${index}.phone`}
                          label="Phone"
                          type="tel"
                          required
                        />
                        <TextareaField
                          control={form.control}
                          name={`contacts.${index}.address`}
                          label="Home address"
                          rows={2}
                          className="sm:col-span-2"
                        />
                        <SelectField
                          control={form.control}
                          name={`contacts.${index}.state`}
                          label="State"
                          options={NIGERIA_STATE_OPTIONS}
                          placeholder="Select a state"
                          native
                          onValueChange={() =>
                            form.setValue(`contacts.${index}.city`, '', { shouldDirty: true })
                          }
                        />
                        {contactCityOptions.length > 0 ? (
                          <SelectField
                            control={form.control}
                            name={`contacts.${index}.city`}
                            label="City"
                            options={contactCityOptions}
                            placeholder="Select a city"
                            native
                          />
                        ) : (
                          <TextField
                            control={form.control}
                            name={`contacts.${index}.city`}
                            label="City"
                            hint={!contactState ? 'Pick a state to choose from a list.' : undefined}
                          />
                        )}
                        <CheckboxField
                          control={form.control}
                          name={`contacts.${index}.isPrimaryContact`}
                          label="Primary contact"
                          description="Receives the decision, and is billed for fees once enrolled."
                          className="sm:col-span-2"
                        />
                      </div>
                    </div>
                  );
                })}

                <Button
                  data-cy="admissions-admission-form-add-another-guardian"
                  type="button"
                  variant="outline"
                  onClick={() => contacts.append({ ...emptyContact })}
                >
                  <Plus />
                  Add another contact
                </Button>

                {form.formState.errors.contacts?.message && (
                  <p role="alert" className="text-xs text-danger">
                    {form.formState.errors.contacts.message}
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
