import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Flag, HeartHandshake, Telescope } from 'lucide-react';
import { useSite } from '../site-context';
import { Container, Reveal, Section, SectionHeading, SiteIcon, SiteImage } from './site-ui';

/**
 * The blocks that make up the school's story.
 *
 * Their home page and their About Us page carry the same sections, so the
 * sections live here once and both pages compose them.
 */

/* -- Learn more about AB.10 ------------------------------------------------ */

export function AboutIntro({ showReadMore = false }: { showReadMore?: boolean }) {
  const { content, path } = useSite();
  const { about } = content;

  return (
    <Section>
      <Container>
        <p className="site-eyebrow">Offers</p>
        <p className="site-display mt-3 max-w-3xl text-[1.25rem] leading-snug text-[var(--site-ink)]">
          {content.offers}
        </p>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <Reveal>
            <h2 className="text-[1.75rem] sm:text-[2.125rem]">{about.title}</h2>
            <div className="mt-5 space-y-4">
              {about.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="site-lede">
                  {paragraph}
                </p>
              ))}
            </div>
            {showReadMore && (
              <Link to={path('about')} className="site-inline-link mt-7">
                Read More
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </Reveal>

          <Reveal delayMs={80}>
            <figure className="site-card overflow-hidden">
              {about.founder.photo && (
                <SiteImage
                  image={about.founder.photo}
                  className="aspect-[4/3] w-full object-cover object-top"
                />
              )}
              <figcaption className="p-6">
                <p className="site-display text-lg font-semibold text-[var(--site-ink)]">
                  {about.founder.name}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--site-accent)]">
                  {about.founder.role}
                </p>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* -- Photo strip and excursions -------------------------------------------- */

export function ExcursionsBlock() {
  const { content } = useSite();
  const { about } = content;

  return (
    <Section tone="canvas">
      <Container>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {about.images.map((image) => (
            <SiteImage
              key={image.src}
              image={image}
              className="aspect-[4/3] w-full rounded-xl object-cover"
            />
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-6 rounded-2xl bg-white p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div className="max-w-2xl">
            <h2 className="text-[1.5rem] sm:text-[1.75rem]">{about.excursions.title}</h2>
            <p className="site-lede mt-3">{about.excursions.body}</p>
          </div>
          <a href="#becomeastudent" className="site-btn site-btn--primary shrink-0">
            Get Started Now
          </a>
        </div>
      </Container>
    </Section>
  );
}

/* -- Vision, mission, philosophy, aspiration ------------------------------- */

export function EthosBlock() {
  const { content } = useSite();
  const { about } = content;

  const pillars = [
    { key: 'Our Vision', text: about.vision, strap: undefined, Icon: Telescope },
    { key: 'Our Mision', text: about.mission, strap: undefined, Icon: Flag },
    { key: 'Our Philosophy', text: about.philosophy, strap: about.philosophyStrap, Icon: Compass },
    { key: 'Our Aspiration', text: about.aspiration, strap: undefined, Icon: HeartHandshake },
  ];

  return (
    <Section>
      <Container>
        <div className="grid gap-6 md:grid-cols-2">
          {pillars.map(({ key, text, strap, Icon }, index) => (
            <Reveal key={key} delayMs={index * 60} className="h-full">
              <div className="site-card h-full p-7">
                <span className="grid size-11 place-items-center rounded-lg bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl">{key}</h2>
                <p className="mt-2.5 leading-relaxed text-[var(--site-body)]">{text}</p>
                {strap && (
                  <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-[var(--site-accent)]">
                    {strap}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* -- Location, curriculum, religious belief -------------------------------- */

export function SchoolFactsBlock() {
  const { content } = useSite();
  const { about } = content;

  return (
    <Section tone="canvas">
      <Container className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <h2 className="text-[1.5rem] sm:text-[1.75rem]">Our Location &amp; Staff Strength</h2>
          <p className="site-lede mt-4">{about.location}</p>

          <h2 className="mt-10 text-[1.5rem] sm:text-[1.75rem]">Our Religious Belief</h2>
          <div className="mt-4 space-y-3">
            {about.religiousBelief.map((line) => (
              <p key={line.slice(0, 30)} className="site-lede">
                {line}
              </p>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={80}>
          <h2 className="text-[1.5rem] sm:text-[1.75rem]">Our Curriculums</h2>
          <div className="mt-4 space-y-4">
            {about.curriculum.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="site-lede">
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* -- The meaning of our name ----------------------------------------------- */

export function NameMeaningBlock() {
  const { content } = useSite();

  return (
    <Section tone="band">
      <Container>
        <SectionHeading
          eyebrow="From inception, AB.10 School means:"
          title="THE MEANING OF OUR NAME"
          align="center"
          onDark
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {content.about.nameMeaning.map((entry) => (
            <li key={entry.letter} className="overflow-hidden rounded-xl border border-white/15 bg-white/5">
              <SiteImage image={entry.image} className="aspect-[4/3] w-full object-cover" />
              <div className="p-5 text-center">
                <span className="site-display block text-3xl font-semibold text-[var(--site-gold)]">
                  {entry.letter}
                </span>
                <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-white/50">
                  means
                </span>
                <span className="mt-1.5 block text-sm font-semibold text-white">{entry.word}</span>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/* -- Core values ----------------------------------------------------------- */

export function CoreValuesBlock() {
  const { content } = useSite();

  return (
    <Section>
      <Container>
        <SectionHeading title="CORE VALUES" align="center" />
        <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {content.about.values.map((value) => (
            <li
              key={value.name}
              className="site-card site-card--hover flex flex-col items-center gap-3 p-5 text-center"
            >
              <span className="grid size-11 place-items-center rounded-full bg-[var(--site-brand-soft)] text-[var(--site-brand)]">
                <SiteIcon name={value.icon} className="size-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--site-ink)]">
                {value.name}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/* -- Management team ------------------------------------------------------- */

export function ManagementBlock() {
  const { content } = useSite();
  const { management } = content.about;

  return (
    <Section tone="canvas">
      <Container>
        <SectionHeading title={management.title} lede={management.intro} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {management.people.map((person, index) => (
            <Reveal key={person.name} delayMs={index * 70} className="h-full">
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
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
