import { useParams } from 'react-router-dom';
import { CalendarDays, GraduationCap, Mail, MapPin, Phone, Quote } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { usePublicSchool } from './api';
import { Badge, Card, CardContent } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/feedback';

/**
 * A school's public profile (`/s/:slug`).
 *
 * This route is deliberately outside the authenticated shell: it reads only the
 * public endpoint, so no session, tenant header or cached school data is
 * involved and there is nothing here that could leak enrolled-student
 * information (spec section 31). It is the page a custom domain would map to.
 */
export function SchoolWebsitePage() {
  const { slug } = useParams<{ slug: string }>();
  const page = usePublicSchool(slug);

  if (page.isPending) return <LoadingState label="Loading school…" />;
  if (page.isError || !page.data) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <ErrorState
          error={page.error}
          title="This school page is not available"
          onRetry={() => void page.refetch()}
        />
      </div>
    );
  }

  const { school, website, news, events } = page.data;
  const brand = school.branding.primaryColor;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border" style={{ backgroundColor: brand }}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 text-white sm:px-6">
          {school.branding.logoUrl ? (
            <img
              src={school.branding.logoUrl}
              alt=""
              className="size-10 rounded-lg bg-white/10 object-contain p-1"
            />
          ) : (
            <span className="grid size-10 place-items-center rounded-lg bg-white/15">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{school.name}</p>
            <p className="truncate text-sm text-white/80">{website.tagline}</p>
          </div>
          {website.admissionsOpen && (
            <span className="ml-auto hidden rounded-full bg-white/15 px-3 py-1 text-xs font-medium sm:block">
              Admissions open
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">About the school</h1>
          <p className="whitespace-pre-line text-muted-foreground">{website.about}</p>
          {(website.mission || website.vision) && (
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              {website.mission && (
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm font-semibold">Our mission</p>
                    <p className="mt-1 text-sm text-muted-foreground">{website.mission}</p>
                  </CardContent>
                </Card>
              )}
              {website.vision && (
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm font-semibold">Our vision</p>
                    <p className="mt-1 text-sm text-muted-foreground">{website.vision}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>

        {website.admissionsIntro && (
          <section className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Admissions</h2>
            <p className="text-muted-foreground">{website.admissionsIntro}</p>
            <Badge tone={website.admissionsOpen ? 'success' : 'neutral'}>
              {website.admissionsOpen ? 'Applications are open' : 'Applications are closed'}
            </Badge>
          </section>
        )}

        {news.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Latest news</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {news.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  {post.coverImageUrl && (
                    <img src={post.coverImageUrl} alt="" className="h-32 w-full object-cover" />
                  )}
                  <CardContent className="space-y-1 pt-4">
                    <Badge tone="primary">{post.category.toLowerCase()}</Badge>
                    <p className="font-medium leading-snug">{post.title}</p>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
                    {post.publishedAt && (
                      <p className="pt-1 text-xs text-muted-foreground">
                        {formatDate(post.publishedAt)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Upcoming dates</h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {events.map((event) => (
                <li key={event.id} className="flex items-center gap-3 p-3.5">
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.startDate)}
                      {event.endDate !== event.startDate && ` – ${formatDate(event.endDate)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {website.testimonials.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">What families say</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {website.testimonials.map((testimonial) => (
                <Card key={testimonial.id}>
                  <CardContent className="space-y-2 pt-5">
                    <Quote className="size-4 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm italic text-muted-foreground">{testimonial.quote}</p>
                    <p className="text-sm font-medium">
                      {testimonial.author}
                      <span className="font-normal text-muted-foreground"> · {testimonial.role}</span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Contact</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
              <a href={`mailto:${website.contactEmail}`} className="hover:underline">
                {website.contactEmail}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
              <a href={`tel:${website.contactPhone}`} className="hover:underline">
                {website.contactPhone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{website.address}</span>
            </li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {school.name} · {school.city}, {school.state} · Powered by Scholaris
      </footer>
    </div>
  );
}
