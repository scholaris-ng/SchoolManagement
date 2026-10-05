import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useSite } from '../site-context';
import type { SiteLevel, SiteProgramme } from '../site-content';
import { FeatureGrid, PageHero, PhotoGrid } from '../components/site-sections';
import {
  Container,
  EMPTY_SITE_IMAGE,
  Reveal,
  Section,
  SectionHeading,
  SiteImage,
} from '../components/site-ui';

/**
 * One section of a school, resolved by slug.
 *
 * Two kinds of thing live at this address. AB.10 has authored `programmes`,
 * rich enough to carry a staff lead, a feature grid and a photo wall. Every
 * other tenant has `levels` instead — its real academic ladder, with whatever
 * it has written about each rung so far — which gets the plainer view below.
 * A level is listed because the school teaches it, so its page has to stand up
 * before anyone has written a word about it.
 */
export function SiteProgrammePage() {
  const { programme: slug } = useParams<{ programme: string }>();
  const { content, path } = useSite();

  const programme = content.programmes.find((item) => item.slug === slug);
  const level = content.levels.find((item) => item.slug === slug);

  if (programme) return <ProgrammeView programme={programme} />;
  if (level) return <LevelView level={level} />;

  // The address is typeable whether or not anything answers to it, so it
  // resolves to the first thing this tenant does have rather than crashing on
  // an empty array's first entry.
  const fallback = content.programmes[0]
    ? path(`schools/${content.programmes[0].slug}`)
    : content.levels[0]
      ? path(`schools/${content.levels[0].slug}`)
      : path('');

  return <Navigate to={fallback} replace />;
}

/** One level of the academic ladder, for a school with no authored programmes. */
function LevelView({ level }: { level: SiteLevel }) {
  const { content, path } = useSite();
  const others = content.levels.filter((item) => item.slug !== level.slug);

  return (
    <>
      <PageHero
        title={level.name}
        lede={level.summary}
        image={level.image ?? EMPTY_SITE_IMAGE}
        crumbs={[{ label: level.name }]}
      />

      <Section>
        <Container className="max-w-3xl">
          <Reveal>
            {level.body.length > 0 ? (
              <div className="space-y-4">
                {level.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="site-lede">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              // Nothing written for this level yet. Saying so plainly beats an
              // empty page, and the form below every page is the one thing a
              // visitor can still usefully do from here.
              <p className="site-lede">
                We haven’t published the details for {level.name} yet. You are welcome to apply or
                get in touch, and we will tell you everything you need to know.
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#becomeastudent" className="site-btn site-btn--primary">
                Apply to {level.name}
              </a>
              <Link to={path('contact')} className="site-btn site-btn--outline">
                Contact us
              </Link>
            </div>
          </Reveal>
        </Container>
      </Section>

      {others.length > 0 && (
        <Section tone="canvas">
          <Container>
            <SectionHeading title="What else we offer" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((other) => (
                <Link
                  key={other.slug}
                  to={path(`schools/${other.slug}`)}
                  className="site-card site-card--hover group p-5"
                >
                  <h3 className="text-lg">{other.name}</h3>
                  {other.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--site-body)]">
                      {other.summary}
                    </p>
                  )}
                  <span className="site-inline-link mt-2 text-sm">
                    Explore
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}

/** AB.10's own authored section, unchanged. */
function ProgrammeView({ programme }: { programme: SiteProgramme }) {
  const { content, path } = useSite();
  const others = content.programmes.filter((item) => item.slug !== programme.slug);

  return (
    <>
      <PageHero
        title={programme.name}
        image={programme.gallery[0] ?? programme.image}
        crumbs={[{ label: programme.navLabel }]}
      />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
          <Reveal>
            <div className="space-y-4">
              {programme.overview.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="site-lede">
                  {paragraph}
                </p>
              ))}
            </div>
          </Reveal>

          {programme.head && (
            <Reveal delayMs={80}>
              <figure className="site-card overflow-hidden">
                {programme.head.photo && (
                  <SiteImage
                    image={programme.head.photo}
                    className="aspect-[4/3] w-full object-cover object-top"
                  />
                )}
                <figcaption className="p-6">
                  <p className="site-display text-lg font-semibold text-[var(--site-ink)]">
                    {programme.head.name}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--site-accent)]">
                    {programme.head.role}
                  </p>
                </figcaption>
              </figure>
            </Reveal>
          )}
        </Container>
      </Section>

      <Section tone="canvas">
        <Container>
          <FeatureGrid items={programme.features} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading title={`Life in the ${programme.navLabel}`} align="center" />
          <div className="mt-12">
            <PhotoGrid images={programme.gallery} limit={12} />
          </div>
        </Container>
      </Section>

      {others.length > 0 && (
        <Section tone="canvas">
          <Container>
            <SectionHeading title="Also at AB.10" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {others.map((other) => (
                <Link
                  key={other.slug}
                  to={path(`schools/${other.slug}`)}
                  className="site-card site-card--hover group flex items-center gap-5 p-5"
                >
                  <SiteImage
                    image={other.gallery[0] ?? other.image}
                    className="size-24 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="text-lg">{other.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--site-body)]">
                      {other.summary}
                    </p>
                    <span className="site-inline-link mt-2 text-sm">
                      Explore
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}
