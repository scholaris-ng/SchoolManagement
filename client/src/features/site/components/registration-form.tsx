import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, ArrowRight, MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/api-error';
import { usePublicAdmissionOptions, useSubmitApplication } from '@/features/public/api';
import type { PublicAdmissionOptions, PublicApplicationReceipt } from '@/types/admissions';
import { useSite } from '../site-context';
import {
  emptySiteApplicant,
  emptySiteContact,
  fieldsForStep,
  siteApplicationSchema,
  stepsFor,
  type SiteApplicationValues,
} from '../application.schema';
import { Container, SiteImage } from './site-ui';
import { ApplicantsStep, ContactsStep, SchoolingStep, WhoStep } from './registration-steps';
import { ApplicationReceipt, ReviewStep } from './registration-review';

/**
 * The school's application form, on its own website.
 *
 * It takes the same application the admissions office takes at the desk, in
 * the same shape, validated by the same schema — `@/features/admissions/schema`
 * is the single definition both forms extend. What a parent fills in here
 * arrives in the admissions list as a real application with a reference
 * number, not as an email somebody has to key in again.
 *
 * Two things are deliberate. The first question is who is filling the form in,
 * because a parent applying for three children and an SS2 student applying for
 * themselves need different questions and different people written to; the
 * steps after it are chosen from that answer rather than fixed.
 *
 * The second is what submitting does NOT do. It creates applications, and
 * nothing else — no account, and no guardian record for whoever filled it in.
 * Anyone can reach this form; a guardian record carries portal access to a
 * child's file and a fee liability, so it is created only when the school
 * enrols the child, after screening and acceptance.
 *
 * The picklists in the schooling step show the school's real sessions and
 * classes whenever it has any — that is a fact about the school's structure,
 * independent of whether it happens to be taking applications this term. A
 * school with no sessions or classes configured at all, or one that is
 * currently closed to applications, falls back to the same mail handoff this
 * form has always had, with the same wizard in front of it.
 */
export function RegistrationSection() {
  const { content } = useSite();
  const { registration } = content;

  return (
    <section id="becomeastudent" className="site-band py-16 sm:py-20">
      <Container className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28">
          <p className="site-eyebrow site-eyebrow--light">Join Us</p>
          <h2 className="mt-4 text-[1.75rem] text-white sm:text-[2.125rem]">{registration.title}</h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-white/75">{registration.intro}</p>
          <SiteImage
            image={{ src: '/site/contact/ab10school-building.jpg', alt: 'The AB.10 Schools campus' }}
            className="mt-8 hidden aspect-[16/10] w-full rounded-2xl object-cover lg:block"
          />
        </div>

        <div className="rounded-2xl bg-white p-6 sm:p-8">
          <ApplicationForm />
        </div>
      </Container>
    </section>
  );
}

function ApplicationForm() {
  const { slug } = useParams<{ slug: string }>();
  const { content } = useSite();
  const { contact } = content;

  const admissions = usePublicAdmissionOptions(slug);
  const submit = useSubmitApplication(slug);

  const [stepIndex, setStepIndex] = useState(0);
  const [receipt, setReceipt] = useState<PublicApplicationReceipt | null>(null);

  const form = useForm<SiteApplicationValues>({
    resolver: zodResolver(siteApplicationSchema),
    defaultValues: {
      // Unset on purpose: the first step is a real question, and a pre-picked
      // answer is one a visitor can walk past without reading.
      applicantType: undefined,
      sessionId: '',
      applicants: [{ ...emptySiteApplicant }],
      contacts: [{ ...emptySiteContact, isPrimaryContact: true }],
      consentGiven: undefined as unknown as true,
    },
  });

  const applicants = useFieldArray({ control: form.control, name: 'applicants' });
  const contacts = useFieldArray({ control: form.control, name: 'contacts' });
  const applicantType = useWatch({ control: form.control, name: 'applicantType' }) ?? null;

  const steps = useMemo(() => stepsFor(applicantType), [applicantType]);
  // Clamped, and every read below uses the clamped index: the step list is
  // rebuilt whenever the first answer changes, and a stale index must never
  // leave the form on a step that no longer exists.
  const current = Math.min(stepIndex, steps.length - 1);
  const step = steps[current];
  const isLast = current === steps.length - 1;

  const options: PublicAdmissionOptions | null = admissions.data ?? null;
  // Whether the picklists in `SchoolingStep` have real sessions and classes to
  // offer is a fact about the school's own structure — it holds regardless of
  // whether admissions happen to be open, so a school that pauses applications
  // for a term does not lose its dropdowns the moment it flips that switch.
  const hasStructuredOptions = Boolean(
    options && options.sessions.length > 0 && options.levels.length > 0,
  );
  // Submitting online is the separate, narrower question: the school must
  // both have that structure AND currently be taking applications. The API
  // refuses the write when it is closed, so there is nothing to gain by
  // attempting it — the form falls back to the email handoff instead.
  const canSubmitOnline = hasStructuredOptions && Boolean(options?.open);
  const admissionsClosed = Boolean(options) && !options?.open;

  /** Checks only the fields this step put on screen — see `fieldsForStep`. */
  const goNext = async () => {
    const fields = fieldsForStep(step.id, applicantType, {
      applicants: applicants.fields.length,
      contacts: contacts.fields.length,
    }) as FieldPath<SiteApplicationValues>[];

    if (await form.trigger(fields)) setStepIndex(current + 1);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!canSubmitOnline) {
      handOffToEmail(values, contact.email, options);
      return;
    }

    const result = await submit.mutateAsync({
      applicantType: values.applicantType,
      sessionId: values.sessionId,
      applicants: values.applicants,
      contacts: values.contacts,
      consentGiven: true,
    });
    setReceipt(result);
  });

  if (receipt) {
    return (
      <ApplicationReceipt
        receipt={receipt}
        whatsapp={contact.whatsapp[0]}
        onStartAnother={() => {
          form.reset();
          setStepIndex(0);
          setReceipt(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ol className="mb-6 flex gap-2" aria-label="Application steps">
        {steps.map((entry, index) => (
          <li key={entry.id} className="min-w-0 flex-1">
            <span
              className={cn(
                'block h-1 rounded-full',
                index <= current ? 'bg-[var(--site-accent)]' : 'bg-[var(--site-line)]',
              )}
            />
            <span
              className={cn(
                'mt-2 block truncate text-xs font-medium',
                index === current ? 'text-[var(--site-ink)]' : 'text-[var(--site-muted)]',
              )}
            >
              {entry.legend}
            </span>
          </li>
        ))}
      </ol>

      {admissionsClosed && (
        <p className="mb-5 rounded-lg border border-[var(--site-line)] bg-[var(--site-canvas)] p-3.5 text-xs leading-relaxed text-[var(--site-muted)]">
          This school is not currently taking applications online. You are welcome to prepare this
          one anyway — submitting it will open your email so you can send it straight to the
          office.
        </p>
      )}

      <div>
        <h3 className="text-lg text-[var(--site-ink)]">{step.legend}</h3>
        <p className="mb-5 mt-1 text-sm text-[var(--site-muted)]">{step.hint}</p>

        {step.id === 'who' && <WhoStep control={form.control} />}
        {step.id === 'contacts' && (
          <ContactsStep
            control={form.control}
            setValue={form.setValue}
            applicantType={applicantType}
            contacts={contacts}
          />
        )}
        {step.id === 'applicants' && (
          <ApplicantsStep
            control={form.control}
            setValue={form.setValue}
            applicantType={applicantType}
            applicants={applicants}
          />
        )}
        {step.id === 'schooling' && (
          <SchoolingStep
            control={form.control}
            applicantType={applicantType}
            options={options}
            names={form
              .getValues('applicants')
              .map((applicant) => [applicant.firstName, applicant.lastName].filter(Boolean).join(' '))}
          />
        )}
        {step.id === 'review' && (
          <ReviewStep control={form.control} values={form.getValues()} options={options} />
        )}
      </div>

      {submit.isError && (
        <p
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-lg border border-[var(--site-accent)] bg-[color-mix(in_srgb,var(--site-accent)_6%,white)] p-3 text-sm text-[var(--site-ink)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--site-accent)]" aria-hidden="true" />
          {errorMessage(submit.error, 'The application could not be sent. Please try again.')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {current > 0 && (
          <button
            type="button"
            onClick={() => setStepIndex(current - 1)}
            className="site-btn site-btn--outline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Previous
          </button>
        )}

        {isLast ? (
          <button type="submit" className="site-btn site-btn--primary" disabled={submit.isPending}>
            <Send className="size-4" aria-hidden="true" />
            {submit.isPending ? 'Sending…' : 'Submit application'}
          </button>
        ) : (
          <button type="button" onClick={goNext} className="site-btn site-btn--primary">
            Next
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        )}

        <a
          href={`https://wa.me/${contact.whatsapp[0]}`}
          target="_blank"
          rel="noreferrer noopener"
          className="site-btn site-btn--outline"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          WhatsApp
        </a>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--site-muted)]">
        {canSubmitOnline
          ? 'Submitting sends the application straight to the admissions office and gives you a reference number.'
          : 'Submitting opens your mail application with the details prepared for the school office.'}
      </p>
    </form>
  );
}

/**
 * The fallback for whenever `canSubmitOnline` is false — a school with no
 * sessions or classes configured, or one that is not currently open to
 * applications.
 *
 * The same completed application, laid out as text for whoever reads the
 * office inbox. It is worth keeping rather than refusing the visitor: a family
 * that has filled in four steps should not be told to start again somewhere
 * else.
 */
function handOffToEmail(
  values: SiteApplicationValues,
  to: string,
  options: PublicAdmissionOptions | null,
): void {
  const levelName = (levelId: string) =>
    options?.levels.find((level) => level.id === levelId)?.name ?? levelId;
  const sessionName =
    options?.sessions.find((session) => session.id === values.sessionId)?.name ?? values.sessionId;

  const lines = [
    `Application filed by: ${values.applicantType === 'SELF' ? 'the applicant' : 'a parent or guardian'}`,
    `Academic session: ${sessionName}`,
    '',
    ...values.applicants.flatMap((applicant, index) => [
      `Applicant ${index + 1}`,
      `  Name: ${[applicant.lastName, applicant.firstName, applicant.middleName].filter(Boolean).join(' ')}`,
      `  Gender: ${applicant.gender}`,
      `  Date of birth: ${applicant.dateOfBirth}`,
      `  Applying into: ${levelName(applicant.levelId)}`,
      `  Former school: ${applicant.previousSchool || '—'}`,
      `  Former class: ${applicant.previousClass || '—'}`,
      `  Blood group: ${applicant.bloodGroup || '—'}`,
      `  Notes: ${applicant.medicalNotes || '—'}`,
      applicant.email ? `  Email: ${applicant.email}` : '',
      applicant.phone ? `  Phone: ${applicant.phone}` : '',
      applicant.address || applicant.city || applicant.state
        ? `  Address: ${[applicant.address, applicant.city, applicant.state].filter(Boolean).join(', ')}`
        : '',
      '',
    ]),
    ...values.contacts.flatMap((contact, index) => [
      `Contact ${index + 1}${contact.isPrimaryContact ? ' (primary)' : ''}`,
      `  Name: ${[contact.firstName, contact.lastName].filter(Boolean).join(' ')}`,
      `  Relationship: ${contact.relationship}`,
      `  Email: ${contact.email}`,
      `  Phone: ${contact.phone}`,
      `  Occupation: ${contact.occupation || '—'}`,
      `  Address: ${[contact.address, contact.city, contact.state].filter(Boolean).join(', ') || '—'}`,
      '',
    ]),
  ].filter((line) => line !== '');

  const subject = encodeURIComponent('Student application');
  window.location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(lines.join('\n'))}`;
}
