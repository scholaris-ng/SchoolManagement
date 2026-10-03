import { useSite } from '../site-context';
import { NewsCard, PageHero, PhotoGrid } from '../components/site-sections';
import { Container, EMPTY_SITE_IMAGE, Reveal, Section, SectionHeading } from '../components/site-ui';

/** School News & Events — the school's media log. */
export function SiteNewsEventsPage() {
  const { content } = useSite();

  return (
    <>
      <PageHero
        title="School News & Events"
        lede={content.news.subtitle}
        image={content.gallery[4] ?? content.gallery[0] ?? EMPTY_SITE_IMAGE}
        crumbs={[{ label: 'Events' }]}
      />

      <Section>
        <Container>
          <SectionHeading title={content.news.title} />
          {content.news.items.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {content.news.items.map((item, index) => (
                <Reveal key={item.id} delayMs={index * 70} className="h-full">
                  <NewsCard item={item} />
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="mt-10 text-sm text-[var(--site-muted)]">
              Nothing has been published yet — check back soon.
            </p>
          )}
        </Container>
      </Section>

      {content.gallery.length > 0 && (
        <Section tone="canvas">
          <Container>
            <SectionHeading title="Photographs from the school year" align="center" />
            <div className="mt-12">
              <PhotoGrid images={content.gallery} />
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}
