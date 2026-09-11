import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronRight, MapPin, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSite } from '../site-context';
import type { SiteEvent, SiteNewsItem, SiteProgramme, SiteTestimonial } from '../site-content';
import { Container, Reveal, Section, SectionHeading, SiteImage } from './site-ui';

/**
 * Blocks that appear on more than one page.
 *
 * Anything used once lives with the page that uses it; this file is for the
 * pieces that repeat, so the inner pages share a banner and every page can end
 * on the same admissions call to action.
 */

/* -- Inner page banner ----------------------------------------------------- */

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  image: { src: string; alt: string };
  /** Breadcrumb trail, shallowest first. The last entry is the current page. */
  crumbs?: { label: string; href?: string }[];
}

export function PageHero({ eyebrow, title, lede, image, crumbs }: PageHeroProps) {
  const { path } = useSite();

  return (
    <div className="relative isolate overflow-hidden bg-[var(--site-brand-dark)]">
      <SiteImage image={image} eager className="absolute inset-0 size-full object-cover opacity-40" />
      <div className="site-scrim absolute inset-0" />
      <Container className="relative py-14 sm:py-20">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-white/60">
              <li>
                <Link to={path('')} className="hover:text-white">
                  Home
                </Link>
              </li>
              {crumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1.5">
                  <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
                  {crumb.href && index < crumbs.length - 1 ? (
                    <Link to={path(crumb.href)} className="hover:text-white">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-white/90">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && <p className="site-eyebrow site-eyebrow--light">{eyebrow}</p>}
        <h1 className="mt-4 max-w-3xl text-[2rem] text-white sm:text-[2.5rem] lg:text-[3rem]">
          {title}
        </h1>
        {lede && <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-white/75">{lede}</p>}
      </Container>
    </div>
  );
}

/* -- Programmes ------------------------------------------------------------ */

export function ProgrammeCard({ programme }: { programme: SiteProgramme }) {
  const { path } = useSite();

  return (
    <Link
      to={path(`schools/${programme.slug}`)}
      className="site-card site-card--hover group flex h-full flex-col overflow-hidden"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <SiteImage
          image={programme.image}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[var(--site-brand)]">
          {programme.ageRange}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl">{programme.name}</h3>
        <p className="mt-2.5 flex-1 text-[0.9375rem] leading-relaxed text-[var(--site-body)]">
          {programme.summary}
        </p>
        <ul className="mt-4 space-y-1.5 border-t border-[var(--site-line)] pt-4">
          {programme.highlights.slice(0, 3).map((highlight) => (
            <li key={highlight} className="flex gap-2 text-sm text-[var(--site-muted)]">
              <span className="mt-[0.5rem] size-1.5 shrink-0 rounded-full bg-[var(--site-gold)]" />
              {highlight}
            </li>
          ))}
        </ul>
        <span className="site-inline-link mt-5 text-sm">
          Explore this school
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

/* -- News and events ------------------------------------------------------- */

export function NewsCard({ item }: { item: SiteNewsItem }) {
  return (
    <article className="site-card site-card--hover group flex h-full flex-col overflow-hidden">
      <div className="aspect-[16/10] overflow-hidden">
        <SiteImage
          image={item.image}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold uppercase tracking-wider text-[var(--site-accent)]">
            {item.category}
          </span>
          {item.date && (
            <time dateTime={item.date} className="text-[var(--site-muted)]">
              {formatLongDate(item.date)}
            </time>
          )}
        </div>
        <h3 className="mt-2.5 text-[1.0625rem] leading-snug">{item.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--site-body)]">{item.excerpt}</p>
      </div>
    </article>
  );
}

export function EventRow({ event }: { event: SiteEvent }) {
  const date = new Date(event.date);
  const valid = !Number.isNaN(date.getTime());

  return (
    <li className="flex gap-4 border-b border-[var(--site-line)] py-4 last:border-0">
      <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
        <span className="text-lg font-semibold leading-none">
          {valid ? date.getDate() : '–'}
        </span>
        <span className="text-[0.625rem] uppercase tracking-wider">
          {valid ? date.toLocaleString('en-GB', { month: 'short' }) : ''}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="text-base">{event.title}</h3>
        {event.description && (
          <p className="mt-1 text-sm leading-relaxed text-[var(--site-body)]">{event.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-[var(--site-muted)]">
          {valid && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {formatLongDate(event.date)}
              {event.endDate && ` – ${formatLongDate(event.endDate)}`}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {event.location}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/* -- Testimonials ---------------------------------------------------------- */

export function TestimonialCard({ testimonial }: { testimonial: SiteTestimonial }) {
  return (
    <figure className="site-card flex h-full flex-col p-6">
      <Quote className="size-7 text-[var(--site-gold)]" aria-hidden="true" />
      <blockquote className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-[var(--site-body)]">
        {testimonial.quote}
      </blockquote>
      <figcaption className="mt-5 border-t border-[var(--site-line)] pt-4">
        <span className="block text-sm font-semibold text-[var(--site-ink)]">
          {testimonial.author}
        </span>
        <span className="block text-xs text-[var(--site-muted)]">{testimonial.role}</span>
      </figcaption>
    </figure>
  );
}

/* -- Closing call to action ------------------------------------------------ */

export function AdmissionsCta({ className }: { className?: string }) {
  const { content, path } = useSite();

  return (
    <Section tone="band" className={cn('py-14 sm:py-16', className)}>
      <Container className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
        <Reveal className="max-w-xl">
          <p className="site-eyebrow site-eyebrow--light">
            {content.admissions.open
              ? `Admissions open · ${content.admissions.session}`
              : 'Admissions'}
          </p>
          <h2 className="mt-4 text-[1.75rem] text-white sm:text-[2.125rem]">
            Come and see the school for yourself
          </h2>
          <p className="mt-3 text-[1.0625rem] leading-relaxed text-white/75">
            Book a campus tour, meet the head of the section your child would join, and take the fee
            schedule home with you.
          </p>
        </Reveal>
        <div className="flex flex-wrap gap-3">
          <Link to={path('admissions')} className="site-btn site-btn--primary">
            Start an application
          </Link>
          <Link to={path('contact')} className="site-btn site-btn--ghost-light">
            Book a tour
          </Link>
        </div>
      </Container>
    </Section>
  );
}

/* -- Shared heading re-export --------------------------------------------- */

export { SectionHeading };

/* -- Helpers --------------------------------------------------------------- */

export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
