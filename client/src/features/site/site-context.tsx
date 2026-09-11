import { createContext, useCallback, useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicSchool } from '@/features/public/api';
import type { PublicSchoolPage } from '@/features/public/api';
import { defaultContent } from './default-content';
import type { SiteContent } from './site-content';

/**
 * Resolves the content one public site renders.
 *
 * The shipped `defaultContent` is the floor: a school that has filled in
 * nothing still gets a complete page rather than a skeleton of empty sections.
 * Whatever the public API returns for the tenant is layered over the top, field
 * by field, so administrators can take ownership of the site one section at a
 * time instead of all at once.
 *
 * TODO(multi-tenant): while the site ships a single school's content, an
 * unrecognised slug still renders the default. Once the CMS is wired up this
 * should 404 instead — the overlay below is the only place that needs to change.
 */

interface SiteContextValue {
  content: SiteContent;
  /** Absolute path for a page within this school's site. */
  path: (to: string) => string;
  /** True while the tenant's own content is still in flight. */
  loading: boolean;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSite must be used inside <SiteContentProvider>');
  return value;
}

/** Shorthand for the common case — a component that only reads content. */
export function useSiteContent(): SiteContent {
  return useSite().content;
}

export function SiteContentProvider({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const remote = usePublicSchool(slug);

  const path = useCallback(
    (to: string) => {
      const clean = to.replace(/^\/+/, '');
      const base = `/s/${slug ?? ''}`;
      return clean ? `${base}/${clean}` : base;
    },
    [slug],
  );

  const value = useMemo<SiteContextValue>(
    () => ({
      content: overlay(defaultContent, remote.data),
      path,
      loading: remote.isPending,
    }),
    [remote.data, remote.isPending, path],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

/* -- Overlay --------------------------------------------------------------- */

function overlay(base: SiteContent, page: PublicSchoolPage | undefined): SiteContent {
  if (!page) return base;

  const { school, website, news, events } = page;

  return {
    ...base,
    brand: {
      ...base.brand,
      name: school.name || base.brand.name,
      shortName: school.shortName || base.brand.shortName,
      motto: school.branding.motto || base.brand.motto,
      tagline: website.tagline || base.brand.tagline,
      crestUrl: school.branding.logoUrl || base.brand.crestUrl,
      colors: {
        ...base.brand.colors,
        brand: school.branding.primaryColor || base.brand.colors.brand,
        accent: school.branding.accentColor || base.brand.colors.accent,
      },
    },
    hero: {
      ...base.hero,
      slides: website.heroImageUrl
        ? [
            {
              ...base.hero.slides[0],
              image: { src: website.heroImageUrl, alt: school.name },
            },
            ...base.hero.slides.slice(1),
          ]
        : base.hero.slides,
    },
    about: {
      ...base.about,
      history: website.about ? website.about.split('\n\n').filter(Boolean) : base.about.history,
      vision: website.vision || base.about.vision,
      mission: website.mission || base.about.mission,
    },
    welcome: {
      ...base.welcome,
      body: website.about ? website.about.split('\n\n').filter(Boolean) : base.welcome.body,
    },
    gallery: website.gallery.length
      ? website.gallery.map((item) => ({ src: item.url, alt: item.caption ?? school.name }))
      : base.gallery,
    news: news.length
      ? news.map((post) => ({
          id: post.id,
          title: post.title,
          excerpt: post.excerpt,
          date: post.publishedAt ?? '',
          category: toTitleCase(post.category),
          image: post.coverImageUrl
            ? { src: post.coverImageUrl, alt: post.title }
            : base.news[0].image,
        }))
      : base.news,
    events: events.length
      ? events.map((event) => ({
          id: event.id,
          title: event.title,
          date: event.startDate,
          endDate: event.endDate === event.startDate ? undefined : event.endDate,
        }))
      : base.events,
    testimonials: website.testimonials.length
      ? website.testimonials.map((item) => ({
          id: item.id,
          quote: item.quote,
          author: item.author,
          role: item.role,
        }))
      : base.testimonials,
    admissions: {
      ...base.admissions,
      open: website.admissionsOpen,
      intro: website.admissionsIntro || base.admissions.intro,
    },
    contact: {
      ...base.contact,
      addressLines: website.address ? website.address.split(/,\s*/) : base.contact.addressLines,
      phones: website.contactPhone ? [website.contactPhone] : base.contact.phones,
      email: website.contactEmail || base.contact.email,
      socials: website.socialLinks.length ? website.socialLinks : base.contact.socials,
    },
  };
}

function toTitleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
