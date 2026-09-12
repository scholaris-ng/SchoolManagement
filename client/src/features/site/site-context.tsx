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

  const { school, website, news } = page;

  return {
    ...base,
    brand: {
      ...base.brand,
      name: school.name || base.brand.name,
      shortName: school.shortName || base.brand.shortName,
      motto: school.branding.motto || base.brand.motto,
      crestUrl: school.branding.logoUrl || base.brand.crestUrl,
      colors: {
        ...base.brand.colors,
        brand: school.branding.primaryColor || base.brand.colors.brand,
        accent: school.branding.accentColor || base.brand.colors.accent,
      },
    },
    hero: {
      slides: website.heroImageUrl
        ? [
            { ...base.hero.slides[0], image: { src: website.heroImageUrl, alt: school.name } },
            ...base.hero.slides.slice(1),
          ]
        : base.hero.slides,
    },
    about: {
      ...base.about,
      body: website.about ? splitParagraphs(website.about) : base.about.body,
      vision: website.vision || base.about.vision,
      mission: website.mission || base.about.mission,
    },
    gallery: website.gallery.length
      ? website.gallery.map((item) => ({ src: item.url, alt: item.caption ?? school.name }))
      : base.gallery,
    news: news.length
      ? {
          ...base.news,
          items: news.map((post) => ({
            id: post.id,
            title: post.title,
            excerpt: post.excerpt,
            dateLabel: post.publishedAt ? formatDateLabel(post.publishedAt) : '',
            author: post.authorName,
            image: post.coverImageUrl
              ? { src: post.coverImageUrl, alt: post.title }
              : base.news.items[0].image,
          })),
        }
      : base.news,
    testimonials: website.testimonials.length
      ? {
          ...base.testimonials,
          items: website.testimonials.map((item) => ({
            id: item.id,
            quote: item.quote,
            author: item.author,
            role: item.role,
          })),
        }
      : base.testimonials,
    contact: {
      ...base.contact,
      intro: website.admissionsIntro || base.contact.intro,
      address: website.address || base.contact.address,
      phones: website.contactPhone ? [website.contactPhone] : base.contact.phones,
      email: website.contactEmail || base.contact.email,
      facebook: findFacebook(website.socialLinks) ?? base.contact.facebook,
    },
  };
}

function splitParagraphs(value: string): string[] {
  return value.split(/\n{2,}/).filter(Boolean);
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function findFacebook(links: { platform: string; url: string }[]) {
  const match = links.find((link) => link.platform.toLowerCase() === 'facebook');
  return match ? { label: match.platform, url: match.url } : undefined;
}
