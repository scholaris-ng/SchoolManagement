import { useSite } from '../site-context';
import { NewsCard, PageHero, PhotoGrid } from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading } from '../components/site-ui';

/** School News & Events — the school's media log. */
export function SiteNewsEventsPage() {
  const { content } = useSite();

  return (
    <>
      <PageHero
        title="School News & Events"
        lede={content.news.subtitle}
        image={content.gallery[4] ?? content.gallery[0]}
        crumbs={[{ label: 'Events' }]}
      />

      <Section>
        <Container>
          <SectionHeading title={content.news.title} />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {content.news.items.map((item, index) => (
              <Reveal key={item.id} delayMs={index * 70} className="h-full">
                <NewsCard item={item} />
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="canvas">
        <Container>
          <SectionHeading title="Photographs from the school year" align="center" />
          <div className="mt-12">
            <PhotoGrid images={content.gallery} />
          </div>
        </Container>
      </Section>
    </>
  );
}
