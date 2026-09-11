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
 * `ab10Content` is the shipped default. `site-context.tsx` overlays whatever the
 * public API returns for a tenant on top of it, so a school that has filled in
 * nothing still gets a complete, credible page.
 */

/* -- Primitives ------------------------------------------------------------ */

export type SiteIconName =
  | 'award'
  | 'book'
  | 'church'
  | 'compass'
  | 'flask'
  | 'globe'
  | 'handshake'
  | 'heart'
  | 'laptop'
  | 'library'
  | 'music'
  | 'palette'
  | 'shield'
  | 'sparkles'
  | 'sprout'
  | 'stethoscope'
  | 'target'
  | 'trophy'
  | 'users'
  | 'utensils'
  | 'bus'
  | 'bed'
  | 'droplet'
  | 'trees';

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
  tagline: string;
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
  eyebrow: string;
  title: string;
  body: string;
  image: SiteImage;
}

export interface SiteStat {
  value: string;
  label: string;
}

export interface SiteValue {
  name: string;
  description: string;
  icon: SiteIconName;
}

export interface SiteProgramme {
  slug: string;
  name: string;
  ageRange: string;
  summary: string;
  image: SiteImage;
  /** Short bullets shown on the home page card. */
  highlights: string[];
  /** Longer prose for the programme's own page. */
  overview: string;
  curriculum: string[];
  dayInTheLife: { time: string; activity: string }[];
}

export interface SitePerson {
  name: string;
  role: string;
  photo?: SiteImage;
  bio?: string;
}

export interface SiteTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
}

export interface SiteNewsItem {
  id: string;
  title: string;
  excerpt: string;
  /** ISO date. */
  date: string;
  category: string;
  image: SiteImage;
}

export interface SiteEvent {
  id: string;
  title: string;
  /** ISO date. */
  date: string;
  endDate?: string;
  location?: string;
  description?: string;
}

export interface SiteFacility {
  name: string;
  description: string;
  icon: SiteIconName;
}

export interface SiteFaq {
  question: string;
  answer: string;
}

export interface SiteContent {
  brand: SiteBrand;
  hero: {
    slides: SiteHeroSlide[];
    primaryCta: SiteLink;
    secondaryCta: SiteLink;
    stats: SiteStat[];
  };
  welcome: {
    eyebrow: string;
    title: string;
    body: string[];
    signatory: SitePerson;
    images: SiteImage[];
  };
  about: {
    foundedOn: string;
    history: string[];
    vision: string;
    mission: string;
    philosophy: string;
    aspiration: string;
    acronym: { letter: string; word: string; meaning: string }[];
    milestones: { year: string; title: string; description: string }[];
    leadership: SitePerson[];
  };
  values: SiteValue[];
  programmes: SiteProgramme[];
  academics: {
    intro: string;
    curricula: { name: string; description: string }[];
    subjects: string[];
    examinations: string[];
    enrichment: { name: string; description: string; icon: SiteIconName }[];
  };
  facilities: {
    intro: string;
    items: SiteFacility[];
    image: SiteImage;
  };
  gallery: SiteImage[];
  news: SiteNewsItem[];
  events: SiteEvent[];
  testimonials: SiteTestimonial[];
  admissions: {
    open: boolean;
    session: string;
    intro: string;
    steps: { title: string; description: string }[];
    requirements: string[];
    faqs: SiteFaq[];
  };
  subsidiaries: { name: string; description: string; href: string; icon: SiteIconName }[];
  contact: {
    addressLines: string[];
    phones: string[];
    whatsapp: string;
    email: string;
    officeHours: { days: string; hours: string }[];
    mapEmbedUrl: string;
    socials: { platform: string; url: string }[];
  };
  portals: { name: string; description: string; href: string }[];
}
