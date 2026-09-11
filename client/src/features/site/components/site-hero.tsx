import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { useSite } from '../site-context';
import { Container, SiteImage } from './site-ui';

const SLIDE_MS = 7000;

/**
 * The home page hero.
 *
 * The school's own site runs a nine-slide carousel; three tell the same story
 * without asking a visitor on a Lagos mobile connection to download nine
 * photographs. Slides crossfade rather than slide, advance slowly enough to be
 * read, and stop entirely for anyone who has asked for reduced motion or who
 * takes manual control of the dots.
 */
export function SiteHero() {
  const { content, path } = useSite();
  const slides = content.hero.slides;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const active = slides[index] ?? slides[0];

  return (
    <section className="relative isolate overflow-hidden bg-[var(--site-brand-dark)]">
      <div className="absolute inset-0">
        {slides.map((slide, slideIndex) => (
          <SiteImage
            key={slide.image.src}
            image={slide.image}
            eager={slideIndex === 0}
            className="site-hero__slide absolute inset-0 size-full object-cover"
            data-active={slideIndex === index}
          />
        ))}
        <div className="site-scrim absolute inset-0" />
      </div>

      <Container className="relative flex min-h-[560px] flex-col justify-center py-20 lg:min-h-[640px] lg:py-24">
        <div key={index} className="site-fade-in max-w-2xl">
          <p className="site-eyebrow site-eyebrow--light">{active.eyebrow}</p>
          <h1 className="mt-5 text-[2.125rem] leading-[1.12] text-white sm:text-[2.75rem] lg:text-[3.375rem]">
            {active.title}
          </h1>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-white/80 sm:text-lg">
            {active.body}
          </p>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link to={path(content.hero.primaryCta.href)} className="site-btn site-btn--primary">
            {content.hero.primaryCta.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link to={path(content.hero.secondaryCta.href)} className="site-btn site-btn--ghost-light">
            <PlayCircle className="size-4" aria-hidden="true" />
            {content.hero.secondaryCta.label}
          </Link>
        </div>

        {slides.length > 1 && (
          <div className="mt-12 flex items-center gap-2.5" role="tablist" aria-label="Hero slides">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.image.src}
                type="button"
                role="tab"
                aria-selected={slideIndex === index}
                aria-label={slide.eyebrow}
                data-active={slideIndex === index}
                className="site-hero__dot"
                onClick={() => {
                  setIndex(slideIndex);
                  setPaused(true);
                }}
              />
            ))}
          </div>
        )}
      </Container>

      {/* Quick facts, overlapping the section below. */}
      <div className="relative">
        <Container>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl border border-b-0 border-[var(--site-line)] bg-[var(--site-line)] sm:grid-cols-4">
            {content.hero.stats.map((stat) => (
              <div key={stat.label} className="bg-white px-5 py-5 text-center sm:py-6">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="site-display block text-[1.75rem] font-semibold text-[var(--site-brand)]">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-[0.8125rem] leading-snug text-[var(--site-muted)]">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </div>
    </section>
  );
}
