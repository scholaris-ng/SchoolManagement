/**
 * The public website's content model.
 *
 * Every string, image and list the marketing site renders is declared here and
 * nowhere else: the page components below `./pages` are presentational and read
 * this shape only. That separation is deliberate — it is the seam a school
 * administrator will eventually edit through Settings → Website, so the whole
 * type is plain JSON (icons are string keys, not component references) and can
 * travel over the API unchanged.
 *
 * The shape follows the school's own site section for section, so that
 * `default-content.ts` can hold its copy verbatim rather than a paraphrase.
 */

/* -- Primitives ------------------------------------------------------------ */

export type SiteIconName =
  | 'award'
  | 'bed'
  | 'book'
  | 'bus'
  | 'church'
  | 'clipboard'
  | 'compass'
  | 'cpu'
  | 'droplet'
  | 'flask'
  | 'globe'
  | 'handshake'
  | 'heart'
  | 'laptop'
  | 'library'
  | 'megaphone'
  | 'monitor'
  | 'music'
  | 'palette'
  | 'school'
  | 'shield'
  | 'shirt'
  | 'sparkles'
  | 'stethoscope'
  | 'target'
  | 'trees'
  | 'trophy'
  | 'users'
  | 'utensils';

export interface SiteImage {
  src: string;
  alt: string;
}

export interface SiteLink {
  label: string;
  href: string;
  /** Renders as a plain anchor rather than a router link. */
  external?: boolean;
}

/* -- Sections -------------------------------------------------------------- */

export interface SiteBrand {
  name: string;
  shortName: string;
  legalName: string;
  motto: string;
  crestUrl: string;
  /** Hex values; the layout publishes them as CSS custom properties. */
  colors: {
    brand: string;
    brandDark: string;
    brandSoft: string;
    accent: string;
    gold: string;
  };
}

export interface SiteHeroSlide {
  title: string;
  body: string;
  image: SiteImage;
  /** The two calls to action the school pairs with each slide. */
  links: SiteLink[];
}

export interface SiteValue {
  name: string;
  icon: SiteIconName;
}

export interface SitePerson {
  name: string;
  role: string;
  photo?: SiteImage;
}

/** A named block of copy with an icon — facilities, school features, ethos. */
export interface SiteFeature {
  name: string;
  description: string;
  icon: SiteIconName;
}

export interface SiteProgramme {
  slug: string;
  /** Full name as the school writes it. */
  name: string;
  /** Short label for navigation and cards. */
  navLabel: string;
  summary: string;
  image: SiteImage;
  /** Body copy, verbatim, one string per paragraph. */
  overview: string[];
  head?: SitePerson;
  features: SiteFeature[];
  gallery: SiteImage[];
}

export interface SiteTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  photo?: SiteImage;
}

export interface SiteNewsItem {
  id: string;
  title: string;
  excerpt: string;
  /** Displayed exactly as the school publishes it. */
  dateLabel: string;
  author: string;
  image: SiteImage;
}

export interface SiteContent {
  brand: SiteBrand;
  hero: {
    slides: SiteHeroSlide[];
  };
  facilities: {
    title: string;
    intro: string;
    items: SiteFeature[];
  };
  offers: string;
  about: {
    title: string;
    body: string[];
    founder: SitePerson;
    images: SiteImage[];
    excursions: { title: string; body: string };
    vision: string;
    mission: string;
    philosophy: string;
    philosophyStrap: string;
    aspiration: string;
    location: string;
    curriculum: string[];
    religiousBelief: string[];
    nameMeaning: { letter: string; word: string; image: SiteImage }[];
    values: SiteValue[];
    management: { title: string; intro: string; people: SitePerson[] };
  };
  programmes: SiteProgramme[];
  testimonials: { title: string; intro: string; items: SiteTestimonial[] };
  news: { title: string; subtitle: string; items: SiteNewsItem[] };
  gallery: SiteImage[];
  /** Fields of the school's own multi-step registration form. */
  registration: {
    title: string;
    intro: string;
    steps: { legend: string; fields: { name: string; label: string; type: string }[] }[];
  };
  subsidiaries: { name: string; href: string; icon: SiteIconName }[];
  portals: { name: string; href: string }[];
  contact: {
    title: string;
    intro: string;
    address: string;
    phones: string[];
    whatsapp: string[];
    email: string;
    facebook: { label: string; url: string };
    mapEmbedUrl: string;
    videoEmbedUrl: string;
  };
  footer: {
    quickLinks: SiteLink[];
    signUp: { title: string; body: string; cta: string };
    policyUrl: string;
  };
}
