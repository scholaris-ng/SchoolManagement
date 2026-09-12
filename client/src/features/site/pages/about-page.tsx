import { useSite } from '../site-context';
import {
  AboutIntro,
  CoreValuesBlock,
  EthosBlock,
  ManagementBlock,
  NameMeaningBlock,
  SchoolFactsBlock,
} from '../components/about-blocks';
import { PageHero, PhotoGrid } from '../components/site-sections';
import { Container, Section, SectionHeading } from '../components/site-ui';

/** About Us, carrying the same sections the school's own About Us page does. */
export function SiteAboutPage() {
  const { content } = useSite();

  return (
    <>
      {/* The offers line follows immediately in `AboutIntro`, so it is not
          repeated in the banner. */}
      <PageHero title="About Us" image={content.gallery[0]} crumbs={[{ label: 'About Us' }]} />

      <AboutIntro />
      <ManagementBlock />
      <EthosBlock />
      <SchoolFactsBlock />
      <NameMeaningBlock />
      <CoreValuesBlock />

      <Section tone="canvas">
        <Container>
          <SectionHeading title="Around the school" align="center" />
          <div className="mt-12">
            <PhotoGrid images={content.gallery} limit={8} />
          </div>
        </Container>
      </Section>
    </>
  );
}
