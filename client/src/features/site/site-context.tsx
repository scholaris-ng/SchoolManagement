import { createContext, useCallback, useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicSchool } from '@/features/public/api';
import type { PublicSchoolPage } from '@/features/public/api';
import { defaultContent } from './default-content';
import { placeholderContent } from './placeholder-content';
import { siteSlugFromHost } from './site-host';
import { SITE_ICON_OPTIONS, type SiteIconName } from './site-content';
import type { SiteContent } from './site-content';

/**
 * Mixes a component (`SiteContentProvider`) with plain hooks (`useSite`,
 * `useSiteContent`) in the same module, which is what defeats React Fast
 * Refresh's ability to hot-patch it in place — see the matching note in
 * `app/providers/auth-provider.tsx`. Forcing a full reload instead of a
 * partial hot update is what stops a stray `useSite` "must be used inside
 * provider" error from surfacing after an edit.
 */
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot!.invalidate();
  });
}

/**
 * The one tenant `default-content.ts` is actually written for. AB.10's own
 * `website_content` row carries almost none of its site's real copy — no
 * tagline, no about text, no gallery — because that copy has always lived in
 * code instead, verbatim from their real site. Swapping it for the neutral
 * floor below would blank their live page, not fix anything, so this is the
 * one identity check that keeps their page exactly as it is while every other
 * school gets the generic floor.
 *
 * TODO(multi-tenant): temporary, and should not gain siblings. The real fix
 * is migrating AB.10's copy into the same `WebsiteContent` fields every
 * school already edits through Settings → Website, at which point this
 * constant, `default-content.ts` and this whole comment go away together.
 */
const AB10_SLUG = 'ab10schools';

/**
 * Resolves the content one public site renders.
 *
 * The floor is `placeholderContent` — a neutral, unfinished-but-honest page —
 * for every tenant except AB.10, whose own rich copy is `defaultContent`
 * (see `AB10_SLUG` above). Whatever the public API returns for the tenant is
 * layered over that floor, field by field, so administrators can take
 * ownership of the site one section at a time instead of all at once; a
 * section neither side has anything for simply does not render (see the
 * empty-guards in `about-blocks.tsx`, `home-page.tsx` and `site-footer.tsx`).
 */

interface SiteContextValue {
  content: SiteContent;
  /**
   * Absolute path for a page within this school's site — bare (the tenant
   * lives in the subdomain) under `siteHostRoute`, or `/s/:slug`-prefixed
   * under the `sitePathRoute` fallback (`site.routes.tsx`).
   */
  path: (to: string) => string;
  /** True while the tenant's own content is still in flight. */
  loading: boolean;
  /**
   * Set once loading finishes without a page to show — no such address, or
   * the school has not published one. `content` is still the neutral floor in
   * this case; `SiteLayout` renders its own state instead of the template
   * rather than let a visitor mistake the floor for a real page.
   */
  error: unknown;
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
  // The host wins whenever it names a tenant; `:slug` only exists as a route
  // param under the `sitePathRoute` fallback, where the host names nothing.
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const hostSlug = siteSlugFromHost();
  const slug = hostSlug ?? routeSlug;
  const remote = usePublicSchool(slug);

  const path = useCallback(
    (to: string) => {
      const clean = to.replace(/^\/+/, '');
      const base = hostSlug ? '' : routeSlug ? `/s/${routeSlug}` : '';
      return clean ? `${base}/${clean}` : base || '/';
    },
    [hostSlug, routeSlug],
  );

  const value = useMemo<SiteContextValue>(() => {
    const floor = remote.data?.website.slug === AB10_SLUG ? defaultContent : placeholderContent;
    return {
      content: overlay(floor, remote.data),
      path,
      loading: remote.isPending,
      error: remote.error,
    };
  }, [remote.data, remote.isPending, remote.error, path]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

/* -- Overlay --------------------------------------------------------------- */

function overlay(base: SiteContent, page: PublicSchoolPage | undefined): SiteContent {
  if (!page) return base;

  const { school, website, news, levels } = page;

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
    // The one-line "what the school offers" strap, wherever it appears —
    // above `about.title` on the About page and the footer's brand column.
    // `tagline` has carried this since Settings → Website shipped; nothing
    // read it until now.
    offers: website.tagline || base.offers,
    about: {
      ...base.about,
      body: website.about ? splitParagraphs(website.about) : base.about.body,
      vision: website.vision || base.about.vision,
      mission: website.mission || base.about.mission,
      founder: website.founder
        ? {
            name: website.founder.name,
            role: website.founder.role,
            photo: website.founder.photoUrl
              ? { src: website.founder.photoUrl, alt: website.founder.name }
              : undefined,
          }
        : base.about.founder,
      values: website.values.length
        ? website.values.map((value) => ({ name: value.name, icon: asSiteIcon(value.icon) }))
        : base.about.values,
      management: website.leadership.length
        ? {
            // No admin field for this heading yet — a school with a real
            // leadership list gets a plain, honest title rather than an empty
            // one; AB.10's own richer wording stays untouched since their
            // `leadership` column is empty and this branch never runs for them.
            title: 'Our Leadership Team',
            intro: '',
            people: website.leadership.map((person) => ({
              name: person.name,
              role: person.role,
              photo: person.photoUrl ? { src: person.photoUrl, alt: person.name } : undefined,
            })),
          }
        : base.about.management,
    },
    // Every level the school has set up in Academic setup, in teaching order
    // — the generic stand-in for `programmes` that `site-nav.ts` builds
    // "Schools" from when nothing richer has been authored (`buildNav`).
    levels,
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
              : (base.news.items[0]?.image ?? { src: '', alt: '' }),
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

const VALID_SITE_ICONS = new Set(SITE_ICON_OPTIONS.map((option) => option.value));

/**
 * A value's icon travels through the database as a plain string, validated
 * only at the moment it was written — if the site's own icon set ever drops
 * one that a school already picked, this is what stands between a stale key
 * and `SiteIcon` (`site-ui.tsx`) silently rendering nothing for it.
 */
function asSiteIcon(value: string): SiteIconName {
  return VALID_SITE_ICONS.has(value as SiteIconName) ? (value as SiteIconName) : 'sparkles';
}
