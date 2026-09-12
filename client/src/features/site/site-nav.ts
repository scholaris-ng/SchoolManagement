import type { SiteContent } from './site-content';

/**
 * The public site's menu, mirroring the school's own.
 *
 * Their menu has three entries under Schools even though two of them lead to
 * the same page, and it carries the student portals and the group's clinics
 * alongside. That is kept as it is: this is their information architecture, not
 * a tidier one invented for them.
 */

export interface SiteNavChild {
  label: string;
  href: string;
  external?: boolean;
}

export interface SiteNavItem {
  label: string;
  href: string;
  external?: boolean;
  children?: SiteNavChild[];
}

export function buildNav(content: SiteContent): SiteNavItem[] {
  const [highSchool, nurseryPrimary] = content.programmes;

  return [
    { label: 'Home', href: '' },
    { label: 'About Us', href: 'about' },
    {
      label: 'Schools',
      href: `schools/${highSchool.slug}`,
      children: [
        { label: 'High School', href: `schools/${highSchool.slug}` },
        { label: 'Nursery/Primary', href: `schools/${nurseryPrimary.slug}` },
        { label: 'Creche/After School', href: `schools/${nurseryPrimary.slug}` },
        ...content.portals.map((portal) => ({
          label: portal.name,
          href: portal.href,
          external: true,
        })),
      ],
    },
    { label: 'Events', href: 'news-and-events' },
    {
      label: 'Subsidiaries',
      href: 'contact#subsidiaries',
      children: content.subsidiaries.map((subsidiary) => ({
        label: subsidiary.name,
        href: subsidiary.href,
        external: true,
      })),
    },
    { label: 'Contact Us', href: 'contact' },
  ];
}
