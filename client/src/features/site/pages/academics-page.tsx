import { GraduationCap } from 'lucide-react';
import { useSite } from '../site-context';
import { AdmissionsCta, PageHero } from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading, SiteIcon, SiteImage } from '../components/site-ui';

/** Curriculum, subjects, examinations, enrichment and the rooms it all happens in. */
export function SiteAcademicsPage() {
  const { content } = useSite();
  const { academics, facilities } = content;

  return (
    <>
      <PageHero
        eyebrow="Academics"
        title="A broad curriculum, taught by specialists"
        lede={academics.intro}
        image={content.gallery[1] ?? facilities.image}
        crumbs={[{ label: 'Academics' }]}
      />

      {/* -- Curricula ----------------------------------------------------- */}
      <Section>
        <Container>
          <SectionHeading eyebrow="Curriculum" title="Nigerian and British, side by side" />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {academics.curricula.map((curriculum, index) => (
              <Reveal key={curriculum.name} delayMs={index * 70} className="h-full">
                <div className="site-card h-full p-7">
                  <span className="grid size-11 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
                    <GraduationCap className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl">{curriculum.name}</h3>
                  <p className="mt-2.5 leading-relaxed text-[var(--site-body)]">
                    {curriculum.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-14">
            <h3 className="text-xl">Subjects offered</h3>
            <p className="mt-2 max-w-2xl text-[0.9375rem] text-[var(--site-body)]">
              The list below spans junior and senior secondary. Primary pupils take the core of it in
              age-appropriate form, plus French, music and computer studies.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {academics.subjects.map((subject) => (
                <li key={subject} className="site-chip">
                  {subject}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* -- Examinations -------------------------------------------------- */}
      <Section id="examinations" tone="band">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Examinations"
              title="Nine boards, prepared for inside the timetable"
              lede="Senior students are entered for national and international examinations, with coaching built into the school day rather than sold as an after-school extra."
              onDark
              className="max-w-none"
            />
          </div>
          <ul className="grid grid-cols-2 gap-3 self-center sm:grid-cols-3">
            {academics.examinations.map((exam) => (
              <li
                key={exam}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-4 text-center text-sm font-semibold text-white"
              >
                {exam}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* -- Enrichment ---------------------------------------------------- */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Beyond the syllabus"
            title="Weekend and enrichment programmes"
            lede="Saturday belongs to the things an examination cannot measure."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {academics.enrichment.map((item, index) => (
              <Reveal key={item.name} delayMs={index * 60} className="h-full">
                <div className="site-card site-card--hover h-full p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
                    <SiteIcon name={item.icon} className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base">{item.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* -- Facilities ---------------------------------------------------- */}
      <Section id="facilities" tone="canvas">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <Reveal>
              <SectionHeading
                eyebrow="Facilities"
                title="Rooms built for the subject taught in them"
                lede={facilities.intro}
                className="max-w-none"
              />
              <SiteImage
                image={facilities.image}
                className="mt-8 aspect-[4/3] w-full rounded-2xl object-cover"
              />
            </Reveal>

            <Reveal delayMs={80}>
              <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {facilities.items.map((item) => (
                  <li key={item.name} className="flex gap-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[var(--site-brand)] shadow-sm">
                      <SiteIcon name={item.icon} className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-base">{item.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--site-body)]">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      </Section>

      <AdmissionsCta />
    </>
  );
}
