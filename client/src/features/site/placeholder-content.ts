import type { SiteContent } from './site-content';

/**
 * The floor for a school that is not AB.10 Schools.
 *
 * `default-content.ts` is AB.10's own real copy, kept verbatim — it is not a
 * generic template, and using it as the fallback for every other tenant was
 * the actual bug: a second school with its site switched on but nothing
 * written yet rendered AB.10's founder, their "AB.10 means…" section and
 * their fertility clinic as a subsidiary, under its own name. This object is
 * what a school with nothing written yet renders instead — honest about
 * being unfinished, and carrying nothing that belongs to anyone else.
 *
 * Every image is the empty-`src` sentinel: `SiteImage` (`site-ui.tsx`) shows
 * its brand-coloured placeholder block for that immediately, with no request
 * ever sent for a photograph that does not exist.
 *
 * Sections with no equivalent field on `WebsiteContent` yet — the founder's
 * story, a name-meaning explainer, a management team, core values, the
 * facilities grid, subsidiaries, external portals — are left empty here, and
 * the block that renders each one is written to disappear rather than show a
 * heading over nothing (see `about-blocks.tsx`, `home-page.tsx` and
 * `site-footer.tsx`). They are not gone for good — they are the next things
 * worth giving a school an actual way to write, once this template is proven
 * out. Everything else here is overlaid from the school's own
 * `WebsiteContent` row the moment they fill it in (`site-context.tsx`).
 */

const EMPTY_IMAGE = { src: '', alt: '' };

export const placeholderContent: SiteContent = {
  brand: {
    name: 'This school',
    shortName: 'School',
    legalName: 'This school',
    motto: '',
    crestUrl: '',
    colors: {
      brand: '#1E3A8A',
      brandDark: '#0F2051',
      brandSoft: '#EEF2FC',
      accent: '#C62031',
      gold: '#D4A72C',
    },
  },

  hero: {
    slides: [
      {
        title: 'Welcome',
        body: 'This school is getting its website ready. Details, photographs and the admissions form will appear here as they are added.',
        image: EMPTY_IMAGE,
        links: [
          { label: 'Apply Now', href: '#becomeastudent' },
          { label: 'Contact Us', href: 'contact' },
        ],
      },
    ],
  },

  facilities: { title: '', intro: '', items: [] },

  offers: '',

  about: {
    title: 'About Us',
    body: ['This school has not added its story yet.'],
    founder: { name: '', role: '' },
    images: [],
    excursions: { title: '', body: '' },
    vision: '',
    mission: '',
    philosophy: '',
    philosophyStrap: '',
    aspiration: '',
    location: '',
    curriculum: [],
    religiousBelief: [],
    nameMeaning: [],
    values: [],
    management: { title: '', intro: '', people: [] },
  },

  programmes: [],
  levels: [],

  testimonials: { title: 'What parents say', intro: '', items: [] },

  news: { title: 'News & Events', subtitle: '', items: [] },

  gallery: [],

  registration: {
    title: 'Student Registration',
    intro:
      'Apply for your child, for several of your children at once, or for yourself, directly through this page.',
  },

  subsidiaries: [],
  portals: [],

  contact: {
    title: 'Get In Touch',
    intro: '',
    address: '',
    phones: [],
    whatsapp: [],
    email: '',
    facebook: { label: '', url: '' },
    mapEmbedUrl: '',
    videoEmbedUrl: '',
  },

  footer: {
    quickLinks: [
      { label: 'About Us', href: 'about' },
      { label: 'News & Events', href: 'news-and-events' },
      { label: 'Contact Us', href: 'contact' },
    ],
    signUp: {
      title: 'Apply',
      body: 'Start an application for your child, or for yourself, in a few minutes.',
      cta: 'Apply Now',
    },
    policyUrl: '',
  },
};
