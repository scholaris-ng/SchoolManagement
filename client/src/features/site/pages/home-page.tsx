import { useSite } from '../site-context';
import { SiteHero } from '../components/site-hero';
import {
  AboutIntro,
  CoreValuesBlock,
  EthosBlock,
  ExcursionsBlock,
  ManagementBlock,
  NameMeaningBlock,
  SchoolFactsBlock,
} from '../components/about-blocks';
import { FeatureGrid, TestimonialCard } from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading } from '../components/site-ui';

/**
 * The home page, section for section as the school arranges it: the carousel,
 * facilities, what they offer, their story, ethos, the meaning of the name,
 * core values, the management team and what parents say.
 */
export function SiteHomePage() {
  const { content } = useSite();

  return (
    <>
      <SiteHero />

      <Section tone="canvas">
        <Container>
          <SectionHeading title={content.facilities.title} lede={content.facilities.intro} />
          <div className="mt-12">
            <FeatureGrid items={content.facilities.items} columns={4} />
          </div>
        </Container>
      </Section>

      <AboutIntro showReadMore />
      <ExcursionsBlock />
      <EthosBlock />
      <SchoolFactsBlock />
      <NameMeaningBlock />
      <CoreValuesBlock />
      <ManagementBlock />

      <Section>
        <Container>
          <SectionHeading title={content.testimonials.title} lede={content.testimonials.intro} />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {content.testimonials.items.map((testimonial, index) => (
              <Reveal key={testimonial.id} delayMs={index * 80} className="h-full">
                <TestimonialCard testimonial={testimonial} />
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
