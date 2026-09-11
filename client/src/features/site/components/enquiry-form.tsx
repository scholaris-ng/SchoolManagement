import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { useSite } from '../site-context';

/**
 * The public enquiry form.
 *
 * There is no unauthenticated write endpoint — and adding one would open a spam
 * surface on a route that deliberately holds no session — so the form composes
 * the message and hands it to the visitor's mail client, with WhatsApp as the
 * one-tap alternative most Lagos parents will actually use.
 *
 * TODO(api): when `POST /public/enquiries` exists, submit there and keep the
 * mail client as the fallback for a failed request.
 */
export function EnquiryForm({ compact = false }: { compact?: boolean }) {
  const { content } = useSite();
  const [interest, setInterest] = useState(content.programmes[0]?.name ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const summary = [
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Interested in: ${interest}`,
    '',
    message,
  ].join('\n');

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = encodeURIComponent(`Admission enquiry — ${interest}`);
    window.location.href = `mailto:${content.contact.email}?subject=${subject}&body=${encodeURIComponent(summary)}`;
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className={compact ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2'}>
        <Field label="Full name" htmlFor="enquiry-name">
          <input
            id="enquiry-name"
            name="name"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            placeholder="Your name"
          />
        </Field>
        <Field label="Phone number" htmlFor="enquiry-phone">
          <input
            id="enquiry-phone"
            name="phone"
            required
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={inputClass}
            placeholder="080..."
          />
        </Field>
      </div>

      <Field label="Email address" htmlFor="enquiry-email">
        <input
          id="enquiry-email"
          name="email"
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Which school are you asking about?" htmlFor="enquiry-interest">
        <select
          id="enquiry-interest"
          name="interest"
          value={interest}
          onChange={(event) => setInterest(event.target.value)}
          className={inputClass}
        >
          {content.programmes.map((programme) => (
            <option key={programme.slug} value={programme.name}>
              {programme.name} · {programme.ageRange}
            </option>
          ))}
          <option value="Pre-university programme">Pre-university programme</option>
          <option value="Something else">Something else</option>
        </select>
      </Field>

      <Field label="Your message" htmlFor="enquiry-message">
        <textarea
          id="enquiry-message"
          name="message"
          rows={4}
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={`${inputClass} resize-y`}
          placeholder="Tell us your child's age and current class, and what you would like to know."
        />
      </Field>

      <div className="flex flex-wrap gap-3 pt-1">
        <button type="submit" className="site-btn site-btn--primary">
          <Send className="size-4" aria-hidden="true" />
          Send enquiry
        </button>
        <a
          href={`https://wa.me/${content.contact.whatsapp}`}
          target="_blank"
          rel="noreferrer noopener"
          className="site-btn site-btn--outline"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Chat on WhatsApp
        </a>
      </div>
      <p className="text-xs text-[var(--site-muted)]">
        Sending opens your mail application with the message prepared. We reply within one working day.
      </p>
    </form>
  );
}

const inputClass =
  'w-full rounded-lg border border-[var(--site-line)] bg-white px-3.5 py-2.5 text-[0.9375rem] text-[var(--site-ink)] outline-none transition-colors placeholder:text-[var(--site-muted)] focus:border-[var(--site-brand)] focus:ring-4 focus:ring-[var(--site-brand-soft)]';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[var(--site-ink)]">
        {label}
      </label>
      {children}
    </div>
  );
}
