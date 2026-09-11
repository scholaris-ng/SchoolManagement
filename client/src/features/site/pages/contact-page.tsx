import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, LogIn, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useSite } from '../site-context';
import { PageHero } from '../components/site-sections';
import { EnquiryForm } from '../components/enquiry-form';
import { Container, Reveal, Section, SectionHeading, SiteIcon } from '../components/site-ui';

/** Where we are, when we are open, and every way to reach a person. */
export function SiteContactPage() {
  const { content } = useSite();
  const { contact } = content;

  return (
    <>
      <PageHero
        eyebrow="Contact us"
        title="Come and see us on Idowu Street"
        lede="The front office is open six days a week. Call ahead and we will have the right head of section waiting for you."
        image={content.facilities.image}
        crumbs={[{ label: 'Contact' }]}
      />

      {/* -- Contact cards ------------------------------------------------- */}
      <Section>
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ContactCard icon={<MapPin className="size-5" aria-hidden="true" />} title="Visit">
              <address className="not-italic leading-relaxed">
                {contact.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </ContactCard>

            <ContactCard icon={<Phone className="size-5" aria-hidden="true" />} title="Call">
              {contact.phones.map((phone) => (
                <a
                  key={phone}
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="block hover:text-[var(--site-brand)]"
                >
                  {phone}
                </a>
              ))}
            </ContactCard>

            <ContactCard icon={<Mail className="size-5" aria-hidden="true" />} title="Email">
              <a href={`mailto:${contact.email}`} className="hover:text-[var(--site-brand)]">
                {contact.email}
              </a>
              <a
                href={`https://wa.me/${contact.whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex items-center gap-1.5 hover:text-[var(--site-brand)]"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp us
              </a>
            </ContactCard>

            <ContactCard icon={<Clock className="size-5" aria-hidden="true" />} title="Office hours">
              <ul className="space-y-2">
                {contact.officeHours.map((entry) => (
                  <li key={entry.days}>
                    <span className="block font-medium text-[var(--site-ink)]">{entry.days}</span>
                    <span className="block text-[var(--site-muted)]">{entry.hours}</span>
                  </li>
                ))}
              </ul>
            </ContactCard>
          </div>
        </Container>
      </Section>

      {/* -- Form and map -------------------------------------------------- */}
      <Section tone="canvas">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionHeading
              eyebrow="Write to us"
              title="Send a message"
              lede="Admissions, fees, transport, transfers — ask anything. We reply within one working day."
              className="max-w-none"
            />
            <div className="mt-8">
              <EnquiryForm />
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="overflow-hidden rounded-2xl border border-[var(--site-line)] bg-white">
              <iframe
                title={`Map showing ${content.brand.name}`}
                src={contact.mapEmbedUrl}
                className="h-[420px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="site-card mt-6 p-6">
              <h3 className="text-lg">Already part of the school?</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">
                Results, attendance, fees and messages from your child&apos;s teachers all live in the
                portal.
              </p>
              <Link to="/sign-in" className="site-btn site-btn--brand site-btn--sm mt-5">
                <LogIn className="size-4" aria-hidden="true" />
                Open the portal
              </Link>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* -- Group --------------------------------------------------------- */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="The AB.10 group"
            title="Other places you will find us"
            lede="The school shares a campus and a standard of care with the group's health services."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.subsidiaries.map((subsidiary) => (
              <a
                key={subsidiary.name}
                href={subsidiary.href}
                target="_blank"
                rel="noreferrer noopener"
                className="site-card site-card--hover group flex h-full flex-col p-6"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
                  <SiteIcon name={subsidiary.icon} className="size-5" />
                </span>
                <h3 className="mt-4 flex items-center gap-1.5 text-base">
                  {subsidiary.name}
                  <ArrowUpRight
                    className="size-4 text-[var(--site-muted)] transition-transform group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">
                  {subsidiary.description}
                </p>
              </a>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}

function ContactCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="site-card h-full p-6">
      <span className="grid size-10 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
        {icon}
      </span>
      <h2 className="mt-4 text-base">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">{children}</div>
    </div>
  );
}
