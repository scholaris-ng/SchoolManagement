import { Facebook, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useSite } from '../site-context';
import { PageHero } from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading, SiteIcon } from '../components/site-ui';

/** Contact Us — address, phones, WhatsApp, the map and the school's video. */
export function SiteContactPage() {
  const { content } = useSite();
  const { contact } = content;

  return (
    <>
      <PageHero
        title="Contact Us"
        lede={contact.intro}
        image={content.gallery[8] ?? content.gallery[0]}
        crumbs={[{ label: 'Contact Us' }]}
      />

      <Section>
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ContactCard icon={<MapPin className="size-5" aria-hidden="true" />} title="Address">
              <address className="not-italic leading-relaxed">{contact.address}</address>
            </ContactCard>

            <ContactCard icon={<Phone className="size-5" aria-hidden="true" />} title="Call">
              {contact.phones.map((phone) => (
                <a key={phone} href={`tel:${phone}`} className="block hover:text-[var(--site-brand)]">
                  {phone}
                </a>
              ))}
            </ContactCard>

            <ContactCard
              icon={<MessageCircle className="size-5" aria-hidden="true" />}
              title="WhatsApp"
            >
              {contact.whatsapp.map((number) => (
                <a
                  key={number}
                  href={`https://wa.me/${number}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block hover:text-[var(--site-brand)]"
                >
                  {number}
                </a>
              ))}
            </ContactCard>

            <ContactCard icon={<Mail className="size-5" aria-hidden="true" />} title="Email">
              <a href={`mailto:${contact.email}`} className="hover:text-[var(--site-brand)]">
                {contact.email}
              </a>
              <a
                href={contact.facebook.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex items-center gap-1.5 hover:text-[var(--site-brand)]"
              >
                <Facebook className="size-4" aria-hidden="true" />
                {contact.facebook.label}
              </a>
            </ContactCard>
          </div>
        </Container>
      </Section>

      <Section tone="canvas">
        <Container className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <SectionHeading title="Find us" className="max-w-none" />
            <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--site-line)] bg-white">
              <iframe
                title={`Map showing ${content.brand.name}`}
                src={contact.mapEmbedUrl}
                className="h-[380px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <SectionHeading title="See the school" className="max-w-none" />
            <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--site-line)] bg-black">
              <iframe
                title={`${content.brand.name} video`}
                src={contact.videoEmbedUrl}
                className="aspect-video w-full border-0"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section id="subsidiaries">
        <Container>
          <SectionHeading title="Subsidiaries" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.subsidiaries.map((subsidiary) => {
              const body = (
                <>
                  <span className="grid size-10 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
                    <SiteIcon name={subsidiary.icon} className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base">{subsidiary.name}</h3>
                </>
              );

              return subsidiary.href ? (
                <a
                  key={subsidiary.name}
                  href={subsidiary.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="site-card site-card--hover p-6"
                >
                  {body}
                </a>
              ) : (
                <div key={subsidiary.name} className="site-card p-6">
                  {body}
                </div>
              );
            })}
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
