import { Link } from 'react-router-dom';
import { ArrowUpRight, Facebook, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useSite } from '../site-context';
import { Container } from './site-ui';

/**
 * The footer, carrying the same three blocks the school's own site ends on:
 * how to reach them, their quick links, and the invitation to register.
 */
export function SiteFooter() {
  const { content, path } = useSite();
  const { contact, footer } = content;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--site-brand-dark)] text-white/70">
      <Container className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        <div>
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
          <p className="mt-5 text-sm leading-relaxed">{content.offers}</p>
          <a
            href={contact.facebook.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 hover:border-white/60 hover:text-white"
          >
            <Facebook className="size-3.5" aria-hidden="true" />
            {contact.facebook.label}
          </a>
        </div>

        <div>
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white">
            {contact.title}
          </h3>
          <ul className="mt-5 space-y-3">
            <li className="flex gap-2.5 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--site-gold)]" aria-hidden="true" />
              <address className="not-italic leading-relaxed">{contact.address}</address>
            </li>
            <li className="flex gap-2.5 text-sm">
              <Phone className="mt-0.5 size-4 shrink-0 text-[var(--site-gold)]" aria-hidden="true" />
              <span className="flex flex-col">
                {contact.phones.map((phone) => (
                  <a key={phone} href={`tel:${phone}`} className="hover:text-white">
                    {phone}
                  </a>
                ))}
              </span>
            </li>
            <li className="flex gap-2.5 text-sm">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-[var(--site-gold)]" aria-hidden="true" />
              <a
                href={`https://wa.me/${contact.whatsapp[0]}`}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-white"
              >
                {contact.whatsapp[0]}
              </a>
            </li>
            <li className="flex gap-2.5 text-sm">
              <Mail className="mt-0.5 size-4 shrink-0 text-[var(--site-gold)]" aria-hidden="true" />
              <a href={`mailto:${contact.email}`} className="hover:text-white">
                {contact.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white">
            Quick Links
          </h3>
          <ul className="mt-5 space-y-3">
            {footer.quickLinks.map((link, index) => (
              <li key={`${link.label}-${index}`}>
                <Link to={path(link.href)} className="text-sm hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white">
            {footer.signUp.title}
          </h3>
          <p className="mt-5 text-sm leading-relaxed">{footer.signUp.body}</p>
          <a href="#becomeastudent" className="site-btn site-btn--primary site-btn--sm mt-5">
            {footer.signUp.cta}
          </a>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="py-6">
          <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-white/40">Subsidiaries</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {content.subsidiaries.map((subsidiary) =>
              subsidiary.href ? (
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
              ) : (
                <li key={subsidiary.name} className="text-sm text-white/50">
                  {subsidiary.name}
                </li>
              ),
            )}
          </ul>
        </Container>
      </div>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {content.brand.legalName}
          </p>
          <p className="flex items-center gap-4">
            <a
              href={footer.policyUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-white"
            >
              School Policy
            </a>
            <span>Powered by Scholaris</span>
          </p>
        </Container>
      </div>
    </footer>
  );
}
