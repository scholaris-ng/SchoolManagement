import type { Control, UseFieldArrayReturn, UseFormSetValue } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { Plus, Trash2, UserRound, Users } from 'lucide-react';
import { toDateInputValue } from '@/lib/format';
import { NIGERIA_STATE_OPTIONS, citiesOfNigeriaState } from '@/lib/demographics';
import { GENDER_OPTIONS, RELATIONSHIP_OPTIONS } from '@/features/admissions/schema';
import type { PublicAdmissionOptions } from '@/types/admissions';
import {
  SiteChoiceField,
  SitePhoneField,
  SiteSelectField,
  SiteTextField,
  SiteTextareaField,
} from './site-form-fields';
import type { SiteApplicationValues } from '../application.schema';
import { emptySiteApplicant, emptySiteContact } from '../application.schema';

/**
 * The bodies of the application wizard, one per step.
 *
 * They are pure: every one takes the form control and renders fields. Which of
 * them appear, in what order, and whether "Next" or "Submit" sits underneath is
 * `ApplicationForm`'s decision — see `stepsFor` in `../application.schema`.
 */

type Control_ = Control<SiteApplicationValues>;
type ApplicantType = 'GUARDIAN' | 'SELF' | null;

const WHO_OPTIONS = [
  {
    value: 'GUARDIAN',
    label: 'I am a parent or guardian',
    description:
      'You are applying for your child, or for more than one. The school will write to you.',
  },
  {
    value: 'SELF',
    label: 'I am the one applying',
    description:
      'You are applying for yourself — a senior school or pre-university place. The school will write to you directly.',
  },
];

const TODAY = toDateInputValue(new Date());

export function WhoStep({ control }: { control: Control_ }) {
  return (
    <SiteChoiceField
      control={control}
      name="applicantType"
      label="Who is filling in this form"
      options={WHO_OPTIONS}
    />
  );
}

/**
 * The adults on the application.
 *
 * For a parent this is "your details"; for someone applying for themselves it
 * is the next of kin the school must be able to reach. Either way these people
 * are held with the application and are not yet guardians of a pupil, which
 * the note under the fields says plainly rather than leaving to the privacy
 * policy.
 */
export function ContactsStep({
  control,
  setValue,
  applicantType,
  contacts,
}: {
  control: Control_;
  setValue: UseFormSetValue<SiteApplicationValues>;
  applicantType: ApplicantType;
  contacts: UseFieldArrayReturn<SiteApplicationValues, 'contacts'>;
}) {
  const isSelf = applicantType === 'SELF';
  // `contacts.fields` only reflects rows being added or removed, never a
  // value typed into one of them — the live state a city list has to follow
  // comes from watching the array itself.
  const watched = useWatch({ control, name: 'contacts' });

  return (
    <div className="space-y-5">
      {contacts.fields.map((field, index) => {
        const state = watched?.[index]?.state;
        const cityOptions = citiesOfNigeriaState(state);

        return (
          <fieldset key={field.id} className="space-y-4">
            {contacts.fields.length > 1 && (
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold text-[var(--site-ink)]">
                  {index === 0 ? 'First contact' : `Contact ${index + 1}`}
                </legend>
                <button
                  type="button"
                  onClick={() => contacts.remove(index)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--site-muted)] hover:text-[var(--site-accent)]"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove
                </button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <SiteTextField
                control={control}
                name={`contacts.${index}.firstName`}
                label="First name"
                required
                autoComplete={index === 0 && !isSelf ? 'given-name' : undefined}
              />
              <SiteTextField
                control={control}
                name={`contacts.${index}.lastName`}
                label="Surname"
                required
                autoComplete={index === 0 && !isSelf ? 'family-name' : undefined}
              />
              <SiteSelectField
                control={control}
                name={`contacts.${index}.relationship`}
                label={isSelf ? 'Relationship to you' : 'Relationship to the child'}
                required
                options={[...RELATIONSHIP_OPTIONS]}
              />
              <SiteTextField
                control={control}
                name={`contacts.${index}.occupation`}
                label="Occupation"
              />
              <SiteTextField
                control={control}
                name={`contacts.${index}.email`}
                label="Email"
                type="email"
                required
                autoComplete={index === 0 && !isSelf ? 'email' : undefined}
              />
              <SitePhoneField
                control={control}
                name={`contacts.${index}.phone`}
                label="Phone or WhatsApp"
                required
              />
              <SiteTextareaField
                control={control}
                name={`contacts.${index}.address`}
                label="Home address"
                rows={2}
                className="sm:col-span-2"
              />
              <SiteSelectField
                control={control}
                name={`contacts.${index}.state`}
                label="State"
                options={NIGERIA_STATE_OPTIONS}
                placeholder="Select a state"
                // The city list below belongs to this state, so a city picked
                // under the old one cannot stand once it changes.
                onValueChange={() => setValue(`contacts.${index}.city`, '', { shouldDirty: true })}
              />
              {cityOptions.length > 0 ? (
                <SiteSelectField
                  control={control}
                  name={`contacts.${index}.city`}
                  label="City"
                  options={cityOptions}
                  placeholder="Select a city"
                />
              ) : (
                <SiteTextField
                  control={control}
                  name={`contacts.${index}.city`}
                  label="City"
                  hint={!state ? 'Pick a state to choose from a list.' : undefined}
                  autoComplete={index === 0 && !isSelf ? 'address-level2' : undefined}
                />
              )}
            </div>
          </fieldset>
        );
      })}

      {contacts.fields.length < 4 && (
        <button
          type="button"
          onClick={() => contacts.append({ ...emptySiteContact })}
          className="site-btn site-btn--outline site-btn--sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          {isSelf ? 'Add another contact' : 'Add the other parent'}
        </button>
      )}

      <p className="rounded-lg bg-[var(--site-canvas)] p-3.5 text-xs leading-relaxed text-[var(--site-muted)]">
        These details stay with the application. No parent account is created and nobody is added
        to the school&apos;s records until a place has been offered, accepted and the child
        enrolled.
      </p>
    </div>
  );
}

/** Who the application is for — one person, or several children at once. */
export function ApplicantsStep({
  control,
  setValue,
  applicantType,
  applicants,
}: {
  control: Control_;
  setValue: UseFormSetValue<SiteApplicationValues>;
  applicantType: ApplicantType;
  applicants: UseFieldArrayReturn<SiteApplicationValues, 'applicants'>;
}) {
  const isSelf = applicantType === 'SELF';
  const watched = useWatch({ control, name: 'applicants' });

  return (
    <div className="space-y-5">
      {applicants.fields.map((field, index) => {
        const state = watched?.[index]?.state;
        const cityOptions = citiesOfNigeriaState(state);

        return (
          <fieldset key={field.id} className="space-y-4">
            {!isSelf && (
              <div className="flex items-center justify-between">
                <legend className="flex items-center gap-2 text-sm font-semibold text-[var(--site-ink)]">
                  <UserRound className="size-4 text-[var(--site-brand)]" aria-hidden="true" />
                  {applicants.fields.length > 1 ? `Child ${index + 1}` : 'Your child'}
                </legend>
                {applicants.fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => applicants.remove(index)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--site-muted)] hover:text-[var(--site-accent)]"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <SiteTextField
                control={control}
                name={`applicants.${index}.lastName`}
                label="Surname"
                required
              />
              <SiteTextField
                control={control}
                name={`applicants.${index}.firstName`}
                label="First name"
                required
              />
              <SiteTextField
                control={control}
                name={`applicants.${index}.middleName`}
                label="Other names"
              />
              <SiteSelectField
                control={control}
                name={`applicants.${index}.gender`}
                label="Gender"
                required
                options={[...GENDER_OPTIONS]}
              />
              <SiteTextField
                control={control}
                name={`applicants.${index}.dateOfBirth`}
                label="Date of birth"
                type="date"
                required
                max={TODAY}
              />

              {/* Only somebody applying for themselves is written to directly.
                  On a parent's application these would be the parent's, which is
                  exactly the confusion the contacts step exists to avoid. */}
              {isSelf && (
                <>
                  <SiteTextField
                    control={control}
                    name={`applicants.${index}.email`}
                    label="Your email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                  <SitePhoneField
                    control={control}
                    name={`applicants.${index}.phone`}
                    label="Your phone or WhatsApp"
                    required
                  />
                  <SiteTextField
                    control={control}
                    name={`applicants.${index}.nationality`}
                    label="Nationality"
                  />
                  <SiteTextField
                    control={control}
                    name={`applicants.${index}.stateOfOrigin`}
                    label="State of origin"
                    hint="Where your family is from, not where you live."
                  />
                  <SiteTextareaField
                    control={control}
                    name={`applicants.${index}.address`}
                    label="Home address"
                    rows={2}
                    className="sm:col-span-2"
                  />
                  <SiteSelectField
                    control={control}
                    name={`applicants.${index}.state`}
                    label="State"
                    options={NIGERIA_STATE_OPTIONS}
                    placeholder="Select a state"
                    onValueChange={() =>
                      setValue(`applicants.${index}.city`, '', { shouldDirty: true })
                    }
                  />
                  {cityOptions.length > 0 ? (
                    <SiteSelectField
                      control={control}
                      name={`applicants.${index}.city`}
                      label="City"
                      options={cityOptions}
                      placeholder="Select a city"
                    />
                  ) : (
                    <SiteTextField
                      control={control}
                      name={`applicants.${index}.city`}
                      label="City"
                      hint={!state ? 'Pick a state to choose from a list.' : undefined}
                      autoComplete="address-level2"
                    />
                  )}
                </>
              )}
            </div>
          </fieldset>
        );
      })}

      {!isSelf && applicants.fields.length < 6 && (
        <button
          type="button"
          onClick={() => applicants.append({ ...emptySiteApplicant })}
          className="site-btn site-btn--outline site-btn--sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add another child
        </button>
      )}

      {!isSelf && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--site-muted)]">
          <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Applying for more than one child? Add them here and your details are used for all of
          them. Each child is considered on their own.
        </p>
      )}
    </div>
  );
}

/** Which session and class each applicant is applying into, and from where. */
export function SchoolingStep({
  control,
  applicantType,
  options,
  names,
}: {
  control: Control_;
  applicantType: ApplicantType;
  options: PublicAdmissionOptions | null;
  names: string[];
}) {
  const isSelf = applicantType === 'SELF';
  const sessionOptions = (options?.sessions ?? []).map((session) => ({
    value: session.id,
    label: session.isCurrent ? `${session.name} (current)` : session.name,
  }));
  const levelOptions = (options?.levels ?? []).map((level) => ({
    value: level.id,
    label: level.name,
  }));

  /**
   * A school that has not published its sessions and classes still has to be
   * able to take an application — it goes to the office by email instead. The
   * fields become free text rather than disappearing, because "which class"
   * is the question the office most needs answered.
   */
  const published = sessionOptions.length > 0 && levelOptions.length > 0;

  return (
    <div className="space-y-5">
      {published ? (
        <SiteSelectField
          control={control}
          name="sessionId"
          label="Academic session"
          required
          options={sessionOptions}
          placeholder="Select a session"
          hint="The school year the application is for."
        />
      ) : (
        <SiteTextField
          control={control}
          name="sessionId"
          label="Academic session"
          required
          placeholder="e.g. 2026/2027"
          hint="The school year the application is for."
        />
      )}

      {names.map((name, index) => (
        <fieldset key={index} className="space-y-4">
          {names.length > 1 && (
            <legend className="text-sm font-semibold text-[var(--site-ink)]">
              {name || `Child ${index + 1}`}
            </legend>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {published ? (
              <SiteSelectField
                control={control}
                name={`applicants.${index}.levelId`}
                label={isSelf ? 'Class you are applying into' : 'Class applying into'}
                required
                options={levelOptions}
                placeholder="Select a class"
                className="sm:col-span-2"
              />
            ) : (
              <SiteTextField
                control={control}
                name={`applicants.${index}.levelId`}
                label={isSelf ? 'Class you are applying into' : 'Class applying into'}
                required
                placeholder="e.g. JSS 1"
                className="sm:col-span-2"
              />
            )}
            <SiteTextField
              control={control}
              name={`applicants.${index}.previousSchool`}
              label="Former school"
            />
            <SiteTextField
              control={control}
              name={`applicants.${index}.previousClass`}
              label="Former class"
            />
            <SiteTextField
              control={control}
              name={`applicants.${index}.bloodGroup`}
              label="Blood group"
            />
            <SiteTextareaField
              control={control}
              name={`applicants.${index}.medicalNotes`}
              label="Anything the school should know"
              rows={2}
              className="sm:col-span-2"
              hint="Allergies, medication, or any support needed. Leave it blank if there is none."
            />
          </div>
        </fieldset>
      ))}
    </div>
  );
}
