import type { Control } from 'react-hook-form';
import { CheckCircle2, Mail, MessageCircle } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import type { PublicAdmissionOptions, PublicApplicationReceipt } from '@/types/admissions';
import { SiteCheckboxField } from './site-form-fields';
import type { SiteApplicationValues } from '../application.schema';

/**
 * The last step, and the page a family sees afterwards.
 *
 * Both are here because they are the same idea twice: what was entered, read
 * back in plain words. A form that has just taken a child's date of birth and
 * a medical note owes the person filling it in a chance to see the whole thing
 * before it goes, and a reference number after it has.
 */

export function ReviewStep({
  control,
  values,
  options,
}: {
  control: Control<SiteApplicationValues>;
  values: SiteApplicationValues;
  options: PublicAdmissionOptions | null;
}) {
  const sessionName =
    options?.sessions.find((session) => session.id === values.sessionId)?.name ?? '—';
  const levelName = (levelId: string) =>
    options?.levels.find((level) => level.id === levelId)?.name ?? '—';
  const isSelf = values.applicantType === 'SELF';

  return (
    <div className="space-y-5">
      <dl className="space-y-4">
        <Row label="Academic session" value={sessionName} />

        {values.applicants.map((applicant, index) => (
          <div key={index} className="rounded-lg border border-[var(--site-line)] p-4">
            <p className="text-sm font-semibold text-[var(--site-ink)]">
              {[applicant.lastName, applicant.firstName, applicant.middleName]
                .filter(Boolean)
                .join(' ') || (isSelf ? 'You' : `Child ${index + 1}`)}
            </p>
            <dl className="mt-2 space-y-1.5">
              <Row label="Applying into" value={levelName(applicant.levelId)} />
              <Row
                label="Date of birth"
                value={applicant.dateOfBirth ? formatDate(applicant.dateOfBirth) : '—'}
              />
              <Row label="Gender" value={humanizeEnum(applicant.gender)} />
              {applicant.previousSchool && (
                <Row label="Former school" value={applicant.previousSchool} />
              )}
              {isSelf && applicant.email && <Row label="Email" value={applicant.email} />}
              {isSelf && applicant.phone && <Row label="Phone" value={applicant.phone} />}
              {isSelf && (applicant.city || applicant.state) && (
                <Row
                  label="Location"
                  value={[applicant.city, applicant.state].filter(Boolean).join(', ')}
                />
              )}
            </dl>
          </div>
        ))}

        {values.contacts.map((contact, index) => (
          <div key={index} className="rounded-lg border border-[var(--site-line)] p-4">
            <p className="text-sm font-semibold text-[var(--site-ink)]">
              {[contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
                `Contact ${index + 1}`}
            </p>
            <dl className="mt-2 space-y-1.5">
              <Row label="Relationship" value={humanizeEnum(contact.relationship)} />
              <Row label="Email" value={contact.email || '—'} />
              <Row label="Phone" value={contact.phone || '—'} />
              {(contact.city || contact.state) && (
                <Row label="Location" value={[contact.city, contact.state].filter(Boolean).join(', ')} />
              )}
            </dl>
          </div>
        ))}
      </dl>

      <SiteCheckboxField
        control={control}
        name="consentGiven"
        label={
          <>
            I confirm these details are correct, and that the school may contact me about this
            application.
          </>
        }
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sm">
      <dt className="text-[var(--site-muted)]">{label}</dt>
      <dd className="font-medium text-[var(--site-ink)]">{value}</dd>
    </div>
  );
}

/**
 * Confirmation.
 *
 * The reference numbers are the point of this panel: they are what a parent
 * quotes on the phone, and the only thing they will have if the confirmation
 * email is filtered. One per child, because each is considered separately.
 */
export function ApplicationReceipt({
  receipt,
  whatsapp,
  onStartAnother,
}: {
  receipt: PublicApplicationReceipt;
  whatsapp?: string;
  onStartAnother: () => void;
}) {
  return (
    <div className="text-center">
      <CheckCircle2
        className="mx-auto size-11 text-[var(--site-brand)]"
        aria-hidden="true"
      />
      <h3 className="mt-4 text-xl text-[var(--site-ink)]">
        {receipt.applications.length > 1 ? 'Applications received' : 'Application received'}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">
        The school has it. Keep{' '}
        {receipt.applications.length > 1 ? 'these references' : 'this reference'} — you will be
        asked for {receipt.applications.length > 1 ? 'them' : 'it'} whenever you call about the
        application.
      </p>

      <ul className="mt-5 space-y-2 text-left">
        {receipt.applications.map((application) => (
          <li
            key={application.applicationNo}
            className="rounded-lg border border-[var(--site-line)] bg-[var(--site-canvas)] px-4 py-3"
          >
            <p className="font-mono text-sm font-semibold text-[var(--site-brand)]">
              {application.applicationNo}
            </p>
            <p className="mt-0.5 text-sm text-[var(--site-ink)]">
              {application.applicantName}
              {application.levelName ? ` · ${application.levelName}` : ''}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs leading-relaxed text-[var(--site-muted)]">
        What happens next: the admissions office reviews the application and contacts you about
        screening. Nobody is admitted, and no parent account is created, until a place has been
        offered and accepted.
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <a href={`mailto:${receipt.contactEmail}`} className="site-btn site-btn--outline site-btn--sm">
          <Mail className="size-4" aria-hidden="true" />
          Email the office
        </a>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer noopener"
            className="site-btn site-btn--outline site-btn--sm"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            WhatsApp
          </a>
        )}
        <button type="button" onClick={onStartAnother} className="site-btn site-btn--outline site-btn--sm">
          Start another application
        </button>
      </div>
    </div>
  );
}
