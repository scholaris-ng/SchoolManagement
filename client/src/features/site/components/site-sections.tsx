import { Link } from 'react-router-dom';
import { ChevronRight, Quote } from 'lucide-react';
import { useSite } from '../site-context';
import type { SiteFeature, SiteImage as SiteImageData, SiteNewsItem, SiteTestimonial } from '../site-content';
import { Container, Reveal, SiteIcon, SiteImage } from './site-ui';

/**
 * Blocks that appear on more than one page. Anything used once lives with the
 * page that uses it.
 */

/* -- Inner page banner ----------------------------------------------------- */

interface PageHeroProps {
  title: string;
  lede?: string;
  image: SiteImageData;
  /** Breadcrumb trail, shallowest first. The last entry is the current page. */
  crumbs?: { label: string; href?: string }[];
}

export function PageHero({ title, lede, image, crumbs }: PageHeroProps) {
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
        <h1 className="max-w-3xl text-[1.875rem] text-white sm:text-[2.375rem] lg:text-[2.875rem]">
          {title}
        </h1>
        {lede && <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-white/75">{lede}</p>}
      </Container>
    </div>
  );
}

/* -- Feature cards --------------------------------------------------------- */

export function FeatureGrid({ items, columns = 3 }: { items: SiteFeature[]; columns?: 3 | 4 }) {
  return (
    <div
      className={
        columns === 4
          ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'
      }
    >
      {items.map((item, index) => (
        <Reveal key={item.name} delayMs={Math.min(index, 6) * 50} className="h-full">
          <div className="site-card site-card--hover h-full p-6">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
              <SiteIcon name={item.icon} className="size-5" />
            </span>
            <h3 className="mt-4 text-[1.0625rem]">{item.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">{item.description}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* -- Gallery --------------------------------------------------------------- */

export function PhotoGrid({ images, limit }: { images: SiteImageData[]; limit?: number }) {
  const shown = limit ? images.slice(0, limit) : images;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {shown.map((image) => (
        <SiteImage
          key={image.src}
          image={image}
          className="aspect-square w-full rounded-xl object-cover"
        />
      ))}
    </div>
  );
}

/* -- News ------------------------------------------------------------------ */

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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-[var(--site-muted)]">{item.dateLabel}</span>
          <span className="font-semibold uppercase tracking-wider text-[var(--site-accent)]">
            {item.author}
          </span>
        </div>
        <h3 className="mt-2.5 text-[1.0625rem] leading-snug">{item.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--site-body)]">{item.excerpt}</p>
      </div>
    </article>
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
      <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--site-line)] pt-4">
        {testimonial.photo && (
          <SiteImage
            image={testimonial.photo}
            className="size-11 shrink-0 rounded-full object-cover"
          />
        )}
        <span>
          <span className="block text-sm font-semibold text-[var(--site-ink)]">
            {testimonial.author}
          </span>
          <span className="block text-xs text-[var(--site-muted)]">{testimonial.role}</span>
        </span>
      </figcaption>
    </figure>
  );
}
