import { useSite } from '../site-context';
import { AdmissionsCta, PageHero, ProgrammeCard } from '../components/site-sections';
import { Container, Reveal, Section } from '../components/site-ui';

/** Index of the school sections, for visitors who arrive without a specific one in mind. */
export function SiteSchoolsPage() {
  const { content } = useSite();

  return (
    <>
      <PageHero
        eyebrow="Our schools"
        title="Four schools, one campus, one standard"
        lede="Creche, nursery, primary and high school sit on the same site, share the same values and hand a child on to the next stage without a change of culture."
        image={content.programmes[2]?.image ?? content.facilities.image}
        crumbs={[{ label: 'Our Schools' }]}
      />

      <Section>
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {content.programmes.map((programme, index) => (
              <Reveal key={programme.slug} delayMs={index * 80} className="h-full">
                <ProgrammeCard programme={programme} />
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <AdmissionsCta />
    </>
  );
}
