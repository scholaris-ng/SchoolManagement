import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSite } from '../site-context';
import { PageHero } from '../components/site-sections';
import { EnquiryForm } from '../components/enquiry-form';
import { Container, Reveal, Section, SectionHeading } from '../components/site-ui';

/** How a family joins the school, start to finish. */
export function SiteAdmissionsPage() {
  const { content } = useSite();
  const { admissions } = content;

  return (
    <>
      <PageHero
        eyebrow={admissions.open ? `Admissions open · ${admissions.session}` : 'Admissions'}
        title="Join the AB.10 family"
        lede={admissions.intro}
        image={content.gallery[3] ?? content.facilities.image}
        crumbs={[{ label: 'Admissions' }]}
      />

      {/* -- Process ------------------------------------------------------- */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="The process"
            title="Five steps from first call to first day"
            lede="Nothing here takes longer than it needs to. Most families complete the whole process inside two weeks."
          />
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {admissions.steps.map((step, index) => (
              <Reveal key={step.title} delayMs={index * 60} className="h-full">
                <li className="site-card h-full p-6">
                  <span className="site-display grid size-11 place-items-center rounded-full bg-[var(--site-brand)] text-lg font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--site-body)]">
                    {step.description}
                  </p>
                </li>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* -- Requirements and enquiry -------------------------------------- */}
      <Section tone="canvas">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <Reveal>
            <SectionHeading
              eyebrow="What to bring"
              title="Documents we will ask for"
              className="max-w-none"
            />
            <ul className="mt-7 space-y-3">
              {admissions.requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="flex items-start gap-3 rounded-lg bg-white px-4 py-3.5 text-[0.9375rem] text-[var(--site-ink)]"
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-[var(--site-brand)]" aria-hidden="true" />
                  {requirement}
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-xl border-l-4 border-[var(--site-gold)] bg-white p-5">
              <h3 className="text-base">Fees</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--site-body)]">
                Fees differ by section and by day or boarding place. We send the current schedule by
                email the same working day you ask for it — there is no charge to enquire.
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="site-card p-7">
              <h2 className="text-2xl">Send an enquiry</h2>
              <p className="mt-2 text-[0.9375rem] text-[var(--site-body)]">
                Tell us about your child and we will come back with availability, fees and the next
                assessment date.
              </p>
              <div className="mt-6">
                <EnquiryForm />
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* -- FAQ ----------------------------------------------------------- */}
      <Section>
        <Container className="max-w-3xl">
          <SectionHeading
            eyebrow="Questions"
            title="Answers parents ask for most"
            align="center"
            className="mx-auto"
          />
          <div className="mt-10 divide-y divide-[var(--site-line)] border-y border-[var(--site-line)]">
            {admissions.faqs.map((faq) => (
              <FaqRow key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}

function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="site-display text-[1.0625rem] font-semibold text-[var(--site-ink)]">
          {question}
        </span>
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-[var(--site-muted)] transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <p className="pb-5 text-[0.9375rem] leading-relaxed text-[var(--site-body)]">{answer}</p>
      )}
    </div>
  );
}
