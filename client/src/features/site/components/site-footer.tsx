import { Link } from 'react-router-dom';
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useSite } from '../site-context';
import { Container } from './site-ui';

/**
 * The footer.
 *
 * It repeats the three things a parent looks for after reading a page — where
 * the school is, how to reach a human, and how to start an application — and
 * carries the group companies that the school lists as part of its identity.
 */
export function SiteFooter() {
  const { content, path } = useSite();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--site-brand-dark)] text-white/70">
      <Container className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <img src={content.brand.crestUrl} alt="" className="size-12 object-contain" />
            <span className="leading-tight">
              <span className="site-display block text-lg font-semibold text-white">
                {content.brand.name}
              </span>
              <span className="block text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--site-gold)]">
                {content.brand.motto}
              </span>
            </span>
          </div>
          <p className="mt-5 text-sm leading-relaxed">{content.brand.tagline}</p>
          <ul className="mt-5 flex flex-wrap gap-3">
            {content.contact.socials.map((social) => (
              <li key={social.platform}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 hover:border-white/60 hover:text-white"
                >
                  {social.platform}
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <FooterColumn title="Our schools">
          {content.programmes.map((programme) => (
            <FooterLink key={programme.slug} to={path(`schools/${programme.slug}`)}>
              {programme.name}
            </FooterLink>
          ))}
          <FooterLink to={path('academics')}>Academics & curriculum</FooterLink>
          <FooterLink to={path('academics#facilities')}>Facilities</FooterLink>
        </FooterColumn>

        <FooterColumn title="Information">
          <FooterLink to={path('about')}>About AB.10</FooterLink>
          <FooterLink to={path('admissions')}>Admissions</FooterLink>
          <FooterLink to={path('news-and-events')}>News & events</FooterLink>
          <FooterLink to={path('contact')}>Contact us</FooterLink>
          <FooterLink to="/sign-in">Student & parent portal</FooterLink>
        </FooterColumn>

        <FooterColumn title="Visit us">
          <li className="flex gap-2.5 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--site-gold)]" aria-hidden="true" />
            <address className="not-italic leading-relaxed">
              {content.contact.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </li>
          <li className="flex gap-2.5 text-sm">
            <Phone className="mt-0.5 size-4 shrink-0 text-[var(--site-gold)]" aria-hidden="true" />
            <span className="flex flex-col">
              {content.contact.phones.map((phone) => (
                <a key={phone} href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-white">
                  {phone}
                </a>
              ))}
            </span>
          </li>
          <li className="flex gap-2.5 text-sm">
            <Mail className="mt-0.5 size-4 shrink-0 text-[var(--site-gold)]" aria-hidden="true" />
            <a href={`mailto:${content.contact.email}`} className="hover:text-white">
              {content.contact.email}
            </a>
          </li>
          <li className="flex gap-2.5 text-sm">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-[var(--site-gold)]" aria-hidden="true" />
            <a
              href={`https://wa.me/${content.contact.whatsapp}`}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-white"
            >
              Chat on WhatsApp
            </a>
          </li>
        </FooterColumn>
      </Container>

      <div className="border-t border-white/10">
        <Container className="py-6">
          <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-white/40">
            Part of the AB.10 group
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {content.subsidiaries.map((subsidiary) => (
              <li key={subsidiary.name}>
                <a
                  href={subsidiary.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm hover:text-white"
                >
                  {subsidiary.name}
                  <ArrowUpRight className="size-3.5 opacity-60" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </div>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {content.brand.legalName}. All rights reserved.
          </p>
          <p>Powered by Scholaris</p>
        </Container>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white">
        {title}
      </h3>
      <ul className="mt-5 space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-sm hover:text-white">
        {children}
      </Link>
    </li>
  );
}
