import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useSite } from '../site-context';
import { SiteHero } from '../components/site-hero';
import {
  AdmissionsCta,
  EventRow,
  NewsCard,
  ProgrammeCard,
  TestimonialCard,
} from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading, SiteIcon, SiteImage } from '../components/site-ui';

/** The home page: hero, who we are, what we offer, proof, and a way in. */
export function SiteHomePage() {
  const { content, path } = useSite();

  return (
    <>
      <SiteHero />

      {/* -- Welcome ------------------------------------------------------- */}
      <Section>
        <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="order-2 lg:order-1">
            <SectionHeading
              eyebrow={content.welcome.eyebrow}
              title={content.welcome.title}
              className="max-w-none"
            />
            <div className="mt-5 space-y-4">
              {content.welcome.body.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="site-lede">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-7 flex items-center gap-4 rounded-xl bg-[var(--site-brand-soft)] p-4">
              {content.welcome.signatory.photo && (
                <SiteImage
                  image={content.welcome.signatory.photo}
                  className="size-14 shrink-0 rounded-full object-cover"
                />
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--site-ink)]">
                  {content.welcome.signatory.name}
                </p>
                <p className="text-xs text-[var(--site-muted)]">{content.welcome.signatory.role}</p>
              </div>
            </div>

            <Link to={path('about')} className="site-inline-link mt-7">
              Read our full story
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal className="order-1 lg:order-2">
            <div className="relative">
              <SiteImage
                image={content.welcome.images[0]}
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
              {content.welcome.images[1] && (
                <SiteImage
                  image={content.welcome.images[1]}
                  className="absolute -bottom-8 -left-6 hidden w-2/5 rounded-xl border-4 border-white object-cover shadow-xl sm:block"
                />
              )}
              <div className="absolute -right-3 -top-5 rounded-xl bg-[var(--site-gold)] px-5 py-3 text-center text-[var(--site-brand-dark)] shadow-lg">
                <span className="site-display block text-2xl font-semibold leading-none">
                  {content.about.foundedOn.slice(-4)}
                </span>
                <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em]">
                  Founded
                </span>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* -- Our schools --------------------------------------------------- */}
      <Section tone="canvas" id="schools">
        <Container>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="Our schools"
              title="One campus, every stage of the journey"
              lede="From the creche to pre-university, a child can stay with us from their first steps to their university offer."
            />
            <Link to={path('admissions')} className="site-btn site-btn--outline shrink-0">
              View admission requirements
            </Link>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {content.programmes.map((programme, index) => (
              <Reveal key={programme.slug} delayMs={index * 80}>
                <ProgrammeCard programme={programme} />
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* -- Values -------------------------------------------------------- */}
      <Section tone="band">
        <Container>
          <SectionHeading
            eyebrow="What we stand for"
            title="Six values we teach as deliberately as we teach mathematics"
            lede="Character is not a side effect of schooling here. It is timetabled, modelled and assessed."
            align="center"
            onDark
          />
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {content.values.map((value, index) => (
              <Reveal key={value.name} delayMs={index * 60}>
                <div className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/10 text-[var(--site-gold)]">
                    <SiteIcon name={value.icon} className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg text-white">{value.name}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                      {value.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* -- Academics ----------------------------------------------------- */}
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <Reveal>
            <SectionHeading
              eyebrow="Academics"
              title="Two curricula, taught side by side"
              lede={content.academics.intro}
              className="max-w-none"
            />
            <div className="mt-8 space-y-5">
              {content.academics.curricula.map((curriculum) => (
                <div key={curriculum.name} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--site-brand)]" aria-hidden="true" />
                  <div>
                    <h3 className="text-base">{curriculum.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--site-body)]">
                      {curriculum.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link to={path('academics')} className="site-inline-link mt-7">
              See the full curriculum
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="site-card p-7">
              <h3 className="text-lg">Examinations we prepare candidates for</h3>
              <p className="mt-2 text-sm text-[var(--site-body)]">
                Coaching runs inside the timetable, not as an expensive extra after school.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {content.academics.examinations.map((exam) => (
                  <li key={exam} className="site-chip">
                    {exam}
                  </li>
                ))}
              </ul>

              <h3 className="mt-9 text-lg">Weekend and enrichment programmes</h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {content.academics.enrichment.map((item) => (
                  <li key={item.name} className="flex gap-3">
                    <SiteIcon name={item.icon} className="mt-0.5 size-4 shrink-0 text-[var(--site-accent)]" />
                    <div>
                      <span className="block text-sm font-semibold text-[var(--site-ink)]">
                        {item.name}
                      </span>
                      <span className="block text-xs leading-relaxed text-[var(--site-muted)]">
                        {item.description}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* -- Gallery ------------------------------------------------------- */}
      <Section tone="canvas">
        <Container>
          <SectionHeading
            eyebrow="Life at AB.10"
            title="Assembly, laboratory, choir, field"
            lede="A school day here is busier than a timetable makes it look."
            align="center"
          />
          <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {content.gallery.slice(0, 8).map((image) => (
              <SiteImage
                key={image.src}
                image={image}
                className="aspect-square w-full rounded-xl object-cover"
              />
            ))}
          </div>
        </Container>
      </Section>

      {/* -- News and events ----------------------------------------------- */}
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div>
            <SectionHeading eyebrow="Latest news" title="What has been happening" className="max-w-none" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {content.news.slice(0, 2).map((item, index) => (
                <Reveal key={item.id} delayMs={index * 80}>
                  <NewsCard item={item} />
                </Reveal>
              ))}
            </div>
            <Link to={path('news-and-events')} className="site-inline-link mt-8">
              All news and events
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div>
            <SectionHeading eyebrow="Diary" title="Dates for your calendar" className="max-w-none" />
            <ul className="mt-8">
              {content.events.slice(0, 4).map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* -- Testimonials -------------------------------------------------- */}
      <Section tone="canvas">
        <Container>
          <SectionHeading
            eyebrow="Parent voices"
            title="What families tell us"
            align="center"
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {content.testimonials.map((testimonial, index) => (
              <Reveal key={testimonial.id} delayMs={index * 80}>
                <TestimonialCard testimonial={testimonial} />
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <AdmissionsCta />
    </>
  );
}
