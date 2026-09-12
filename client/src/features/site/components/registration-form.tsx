import { useState } from 'react';
import { ArrowLeft, ArrowRight, MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSite } from '../site-context';
import { Container, SiteImage } from './site-ui';

/**
 * The school's own Student Registration block, reproduced step for step.
 *
 * Their site collects surname, other names, date of birth, WhatsApp, email and
 * the class details across a short wizard, and it appears at the foot of every
 * page under the anchor the "Join Us" button points at. Both are kept.
 *
 * There is no unauthenticated write endpoint, and adding one would open a spam
 * surface on a route that deliberately holds no session, so the completed form
 * is handed to the visitor's mail client with WhatsApp as the one-tap
 * alternative most parents will actually use.
 *
 * TODO(api): when `POST /public/enquiries` exists, submit there and keep the
 * mail client as the fallback for a failed request.
 */
export function RegistrationSection() {
  const { content } = useSite();
  const { registration } = content;

  return (
    <section id="becomeastudent" className="site-band py-16 sm:py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <p className="site-eyebrow site-eyebrow--light">Join Us</p>
          <h2 className="mt-4 text-[1.75rem] text-white sm:text-[2.125rem]">{registration.title}</h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-white/75">{registration.intro}</p>
          <SiteImage
            image={{ src: '/site/contact/ab10school-building.jpg', alt: 'The AB.10 Schools campus' }}
            className="mt-8 hidden aspect-[16/10] w-full rounded-2xl object-cover lg:block"
          />
        </div>

        <div className="rounded-2xl bg-white p-6 sm:p-8">
          <RegistrationForm />
        </div>
      </Container>
    </section>
  );
}

function RegistrationForm() {
  const { content } = useSite();
  const { registration, contact } = content;
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});

  const steps = registration.steps;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const set = (name: string, value: string) =>
    setValues((previous) => ({ ...previous, [name]: value }));

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    const body = steps
      .flatMap((entry) => entry.fields)
      .map((field) => `${field.label}: ${values[field.name] ?? ''}`)
      .join('\n');
    const subject = encodeURIComponent('Student Registration');
    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form onSubmit={onSubmit}>
      <ol className="mb-6 flex gap-2" aria-label="Registration steps">
        {steps.map((entry, index) => (
          <li key={entry.legend} className="flex-1">
            <span
              className={cn(
                'block h-1 rounded-full',
                index <= step ? 'bg-[var(--site-accent)]' : 'bg-[var(--site-line)]',
              )}
            />
            <span
              className={cn(
                'mt-2 block text-xs font-medium',
                index === step ? 'text-[var(--site-ink)]' : 'text-[var(--site-muted)]',
              )}
            >
              {entry.legend}
            </span>
          </li>
        ))}
      </ol>

      <fieldset>
        <legend className="sr-only">{current.legend}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {current.fields.map((field) => (
            <div key={field.name} className={field.type === 'email' ? 'sm:col-span-2' : undefined}>
              <label
                htmlFor={`reg-${field.name}`}
                className="mb-1.5 block text-sm font-medium text-[var(--site-ink)]"
              >
                {field.label}
              </label>
              <input
                id={`reg-${field.name}`}
                name={field.name}
                type={field.type}
                required
                value={values[field.name] ?? ''}
                onChange={(event) => set(field.name, event.target.value)}
                className="w-full rounded-lg border border-[var(--site-line)] bg-white px-3.5 py-2.5 text-[0.9375rem] text-[var(--site-ink)] outline-none transition-colors placeholder:text-[var(--site-muted)] focus:border-[var(--site-brand)] focus:ring-4 focus:ring-[var(--site-brand-soft)]"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="site-btn site-btn--outline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Previous
          </button>
        )}
        <button type="submit" className="site-btn site-btn--primary">
          {isLast ? (
            <>
              <Send className="size-4" aria-hidden="true" />
              Register
            </>
          ) : (
            <>
              Next
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
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

      <p className="mt-4 text-xs text-[var(--site-muted)]">
        Registering opens your mail application with the details prepared for the school office.
      </p>
    </form>
  );
}
