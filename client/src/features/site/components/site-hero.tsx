import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSite } from '../site-context';
import { Container, SiteImage } from './site-ui';

const SLIDE_MS = 7000;

/**
 * The home page hero.
 *
 * The school runs eleven slides, each with its own headline, body and pair of
 * calls to action, and all eleven are here. They crossfade rather than slide,
 * hold long enough to be read, and stop for anyone who has asked for reduced
 * motion or who takes manual control. Only the first photograph is eager: the
 * other ten load as they are reached rather than on arrival.
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

  const go = (next: number) => {
    setIndex((next + slides.length) % slides.length);
    setPaused(true);
  };

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

      <Container className="relative flex min-h-[560px] flex-col justify-center py-20 lg:min-h-[620px] lg:py-24">
        <div key={index} className="site-fade-in max-w-2xl">
          <h1 className="text-[2rem] leading-[1.14] text-white sm:text-[2.625rem] lg:text-[3.125rem]">
            {active.title}
          </h1>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-white/80 sm:text-lg">
            {active.body}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {active.links.map((link, linkIndex) => (
              <Link
                key={link.href + link.label}
                to={path(link.href)}
                className={
                  linkIndex === 0
                    ? 'site-btn site-btn--primary'
                    : 'site-btn site-btn--ghost-light'
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {slides.length > 1 && (
          <div className="mt-12 flex items-center gap-4">
            <div className="flex gap-1.5" role="tablist" aria-label="Hero slides">
              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.image.src}
                  type="button"
                  role="tab"
                  aria-selected={slideIndex === index}
                  aria-label={slide.title}
                  data-active={slideIndex === index}
                  className="site-hero__dot"
                  onClick={() => go(slideIndex)}
                />
              ))}
            </div>
            <span className="text-xs font-medium tabular-nums text-white/50">
              {index + 1} / {slides.length}
            </span>
            <span className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous slide"
                className="grid size-9 place-items-center rounded-full border border-white/30 text-white hover:bg-white/10"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next slide"
                className="grid size-9 place-items-center rounded-full border border-white/30 text-white hover:bg-white/10"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </span>
          </div>
        )}
      </Container>
    </section>
  );
}
