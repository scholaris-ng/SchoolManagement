import { Compass, Flag, HeartHandshake, Telescope } from 'lucide-react';
import { useSite } from '../site-context';
import { AdmissionsCta, PageHero } from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading, SiteIcon, SiteImage } from '../components/site-ui';

/** Our story, what we believe, and who leads the school. */
export function SiteAboutPage() {
  const { content } = useSite();
  const { about } = content;

  const pillars = [
    { key: 'Vision', text: about.vision, Icon: Telescope },
    { key: 'Mission', text: about.mission, Icon: Flag },
    { key: 'Philosophy', text: about.philosophy, Icon: Compass },
    { key: 'Aspiration', text: about.aspiration, Icon: HeartHandshake },
  ];

  return (
    <>
      <PageHero
        eyebrow="About us"
        title={content.brand.tagline}
        lede={`Founded on ${about.foundedOn}, ${content.brand.name} is a Christian co-educational school in Ifako-Ijaiye, Lagos.`}
        image={content.facilities.image}
        crumbs={[{ label: 'About' }]}
      />

      {/* -- Story --------------------------------------------------------- */}
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <Reveal>
            <SectionHeading eyebrow="Our story" title="How AB.10 began" className="max-w-none" />
            <div className="mt-6 space-y-4">
              {about.history.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="site-lede">
                  {paragraph}
                </p>
              ))}
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <ol className="relative border-l border-[var(--site-line)] pl-7">
              {about.milestones.map((milestone) => (
                <li key={milestone.year} className="relative pb-8 last:pb-0">
                  <span className="absolute -left-[2.1rem] top-1 grid size-6 place-items-center rounded-full bg-[var(--site-brand)] text-[0.5625rem] font-bold text-white">
                    ●
                  </span>
                  <span className="site-display block text-lg font-semibold text-[var(--site-brand)]">
                    {milestone.year}
                  </span>
                  <h3 className="mt-0.5 text-base">{milestone.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--site-body)]">
                    {milestone.description}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </Container>
      </Section>

      {/* -- Vision, mission, philosophy, aspiration ----------------------- */}
      <Section tone="canvas">
        <Container>
          <SectionHeading
            eyebrow="What drives us"
            title="Four statements we are held to"
            align="center"
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {pillars.map(({ key, text, Icon }, index) => (
              <Reveal key={key} delayMs={index * 60}>
                <div className="site-card h-full p-7">
                  <span className="grid size-11 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl">{key}</h3>
                  <p className="mt-2.5 leading-relaxed text-[var(--site-body)]">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* -- Values -------------------------------------------------------- */}
      <Section id="values">
        <Container>
          <SectionHeading
            eyebrow="Core values"
            title="Godliness, Integrity, Teamwork, Faith, Discipline, Excellence"
            lede="Six words that decide how a disagreement is settled, how a test is marked and how a child is corrected."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {content.values.map((value, index) => (
              <Reveal key={value.name} delayMs={index * 50}>
                <div className="site-card site-card--hover h-full p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
                    <SiteIcon name={value.icon} className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg">{value.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">
                    {value.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* -- The name ------------------------------------------------------ */}
      <Section tone="band">
        <Container>
          <SectionHeading
            eyebrow="The name"
            title="AB.TEN — the kind of learner we set out to raise"
            align="center"
            onDark
          />
          <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {about.acronym.map((entry) => (
              <li
                key={entry.letter}
                className="rounded-xl border border-white/15 bg-white/5 p-5 text-center"
              >
                <span className="site-display block text-3xl font-semibold text-[var(--site-gold)]">
                  {entry.letter}
                </span>
                <span className="mt-2 block text-sm font-semibold text-white">{entry.word}</span>
                <span className="mt-1.5 block text-xs leading-relaxed text-white/60">
                  {entry.meaning}
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* -- Leadership ---------------------------------------------------- */}
      <Section id="leadership" tone="canvas">
        <Container>
          <SectionHeading
            eyebrow="Leadership"
            title="The people who run the school"
            lede="Every section has a named head who answers to parents directly."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {about.leadership.map((person, index) => (
              <Reveal key={person.name} delayMs={index * 70}>
                <div className="site-card h-full overflow-hidden">
                  {person.photo && (
                    <SiteImage
                      image={person.photo}
                      className="aspect-[4/3] w-full object-cover object-top"
                    />
                  )}
                  <div className="p-6">
                    <h3 className="text-lg">{person.name}</h3>
                    <p className="mt-1 text-sm font-medium text-[var(--site-accent)]">{person.role}</p>
                    {person.bio && (
                      <p className="mt-3 text-sm leading-relaxed text-[var(--site-body)]">
                        {person.bio}
                      </p>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <AdmissionsCta />
    </>
  );
}
