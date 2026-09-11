import { useSite } from '../site-context';
import { AdmissionsCta, EventRow, NewsCard, PageHero } from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading, SiteImage } from '../components/site-ui';

/** School news, the term diary and the photo gallery in one place. */
export function SiteNewsEventsPage() {
  const { content } = useSite();

  return (
    <>
      <PageHero
        eyebrow="News & events"
        title="What is happening at AB.10"
        lede="Term dates, open days, competitions and the moments worth keeping."
        image={content.gallery[0] ?? content.facilities.image}
        crumbs={[{ label: 'News & Events' }]}
      />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div>
            <SectionHeading eyebrow="News" title="From around the school" className="max-w-none" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {content.news.map((item, index) => (
                <Reveal key={item.id} delayMs={index * 70} className="h-full">
                  <NewsCard item={item} />
                </Reveal>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading eyebrow="Diary" title="Term dates and events" className="max-w-none" />
            <ul className="mt-10">
              {content.events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
            <p className="mt-6 text-sm text-[var(--site-muted)]">
              Dates occasionally move. Parents are notified through the school portal before any
              change takes effect.
            </p>
          </div>
        </Container>
      </Section>

      <Section tone="canvas">
        <Container>
          <SectionHeading
            eyebrow="Gallery"
            title="Moments from the school year"
            align="center"
          />
          <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {content.gallery.map((image) => (
              <SiteImage
                key={image.src}
                image={image}
                className="aspect-square w-full rounded-xl object-cover"
              />
            ))}
          </div>
        </Container>
      </Section>

      <AdmissionsCta />
    </>
  );
}
