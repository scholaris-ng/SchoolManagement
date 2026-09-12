import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useSite } from '../site-context';
import { FeatureGrid, PageHero, PhotoGrid } from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading, SiteImage } from '../components/site-ui';

/**
 * One school section: the High School, or the combined Nursery, Primary, Creche
 * and After School. The school's own menu lists three entries for these two
 * pages, and both entries for the younger years land here.
 */
export function SiteProgrammePage() {
  const { programme: slug } = useParams<{ programme: string }>();
  const { content, path } = useSite();

  const programme = content.programmes.find((item) => item.slug === slug);
  const others = content.programmes.filter((item) => item.slug !== slug);

  if (!programme) return <Navigate to={path(`schools/${content.programmes[0].slug}`)} replace />;

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
