import type { SiteContent } from './site-content';

/**
 * The public site's information architecture.
 *
 * Derived from content rather than hard-coded so that adding a fourth school
 * section, or renaming one, changes the menu without anyone editing the header.
 * `href` values are site-relative; `SiteContext.path()` turns them into real
 * URLs under `/s/:slug`.
 */

export interface SiteNavItem {
  label: string;
  href: string;
  children?: { label: string; description?: string; href: string; external?: boolean }[];
}

export function buildNav(content: SiteContent): SiteNavItem[] {
  return [
    { label: 'Home', href: '' },
    {
      label: 'About',
      href: 'about',
      children: [
        { label: 'Our story', description: 'How AB.10 began and where it is going', href: 'about' },
        { label: 'Vision & values', description: 'What we stand for', href: 'about#values' },
        { label: 'Leadership', description: 'The people who run the school', href: 'about#leadership' },
      ],
    },
    {
      label: 'Our Schools',
      href: 'schools',
      children: content.programmes.map((programme) => ({
        label: programme.name,
        description: programme.ageRange,
        href: `schools/${programme.slug}`,
      })),
    },
    {
      label: 'Academics',
      href: 'academics',
      children: [
        { label: 'Curriculum', description: 'Nigerian and British, taught side by side', href: 'academics' },
        { label: 'Examinations', description: 'WASSCE, NECO, UTME, IGCSE and more', href: 'academics#examinations' },
        { label: 'Facilities', description: 'Laboratories, library, studio and field', href: 'academics#facilities' },
      ],
    },
    { label: 'Admissions', href: 'admissions' },
    { label: 'News & Events', href: 'news-and-events' },
    { label: 'Contact', href: 'contact' },
  ];
}
