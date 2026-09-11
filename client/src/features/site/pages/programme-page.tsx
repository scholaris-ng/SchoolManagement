import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, Clock } from 'lucide-react';
import { useSite } from '../site-context';
import { AdmissionsCta, PageHero } from '../components/site-sections';
import { Container, Reveal, Section, SectionHeading, SiteImage } from '../components/site-ui';

/**
 * One school section — creche, nursery/primary or high school.
 *
 * A single component drives all three: the differences between them are content,
 * not layout, so adding a fourth section is an entry in `programmes` rather than
 * another page.
 */
export function SiteProgrammePage() {
  const { programme: slug } = useParams<{ programme: string }>();
  const { content, path } = useSite();

  const programme = content.programmes.find((item) => item.slug === slug);
  const others = content.programmes.filter((item) => item.slug !== slug);

  if (!programme) return <Navigate to={path('schools')} replace />;

  return (
    <>
      <PageHero
        eyebrow={programme.ageRange}
        title={programme.name}
        lede={programme.summary}
        image={programme.image}
        crumbs={[{ label: 'Our Schools', href: 'schools' }, { label: programme.name }]}
      />

      {/* -- Overview and curriculum --------------------------------------- */}
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <Reveal>
            <SectionHeading eyebrow="Overview" title={`Inside the ${programme.name}`} className="max-w-none" />
            <p className="site-lede mt-6">{programme.overview}</p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {programme.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-2.5 rounded-lg bg-[var(--site-brand-soft)] px-4 py-3 text-sm text-[var(--site-ink)]"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--site-brand)]" aria-hidden="true" />
                  {highlight}
                </li>
              ))}
            </ul>

            <h3 className="mt-10 flex items-center gap-2 text-xl">
              <BookOpen className="size-5 text-[var(--site-accent)]" aria-hidden="true" />
              What we teach
            </h3>
            <ul className="mt-4 space-y-2.5">
              {programme.curriculum.map((subject) => (
                <li key={subject} className="flex gap-2.5 text-[0.9375rem] text-[var(--site-body)]">
                  <span className="mt-[0.5625rem] size-1.5 shrink-0 rounded-full bg-[var(--site-gold)]" />
                  {subject}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="site-card overflow-hidden">
              <SiteImage image={programme.image} className="aspect-[4/3] w-full object-cover" />
              <div className="p-6">
                <h3 className="flex items-center gap-2 text-lg">
                  <Clock className="size-4 text-[var(--site-accent)]" aria-hidden="true" />
                  A day in the life
                </h3>
                <ul className="mt-5 space-y-0">
                  {programme.dayInTheLife.map((entry) => (
                    <li
                      key={entry.time}
                      className="flex gap-4 border-b border-[var(--site-line)] py-3 last:border-0"
                    >
                      <span className="w-[4.5rem] shrink-0 text-sm font-semibold text-[var(--site-brand)]">
                        {entry.time}
                      </span>
                      <span className="text-sm leading-relaxed text-[var(--site-body)]">
                        {entry.activity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="site-card mt-6 p-6">
              <h3 className="text-lg">Ready to apply?</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">
                Places in the {programme.name} are limited by class size. Send an enquiry and we will
                confirm availability and the next assessment date.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link to={path('admissions')} className="site-btn site-btn--primary site-btn--sm">
                  Apply now
                </Link>
                <Link to={path('contact')} className="site-btn site-btn--outline site-btn--sm">
                  Ask a question
                </Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* -- Other sections ------------------------------------------------ */}
      {others.length > 0 && (
        <Section tone="canvas">
          <Container>
            <SectionHeading eyebrow="Also at AB.10" title="The other schools on campus" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {others.map((other) => (
                <Link
                  key={other.slug}
                  to={path(`schools/${other.slug}`)}
                  className="site-card site-card--hover group flex items-center gap-5 p-5"
                >
                  <SiteImage
                    image={other.image}
                    className="size-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--site-accent)]">
                      {other.ageRange}
                    </span>
                    <h3 className="mt-1 text-lg">{other.name}</h3>
                    <span className="site-inline-link mt-1.5 text-sm">
                      Explore
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      )}

      <AdmissionsCta />
    </>
  );
}
