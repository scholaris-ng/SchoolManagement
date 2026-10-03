import { platformUrl } from './site-host';
import type { SiteContent } from './site-content';

/**
 * The public site's menu.
 *
 * AB.10's own menu has three entries under Schools even though two of them
 * lead to the same page, and carries the student portals and the group's
 * clinics alongside — that is kept exactly as it is, since it is their
 * information architecture and not a tidier one invented for them.
 *
 * A school with none of that authored yet — every tenant but AB.10, today —
 * gets a menu built from what it actually has: its own levels stand in for
 * "Schools" (each one points at the admissions form, since there is no
 * per-level page yet to send it to instead), and an item with nothing behind
 * it — Schools with no levels defined, Subsidiaries with none named — is left
 * out rather than shown empty.
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
  const nav: SiteNavItem[] = [
    { label: 'Home', href: '' },
    { label: 'About Us', href: 'about' },
  ];

  const schoolsItem = buildSchoolsItem(content);
  if (schoolsItem) nav.push(schoolsItem);

  nav.push({ label: 'Events', href: 'news-and-events' });

  if (content.subsidiaries.length > 0) {
    nav.push({
      label: 'Subsidiaries',
      href: 'contact#subsidiaries',
      children: content.subsidiaries.map((subsidiary) => ({
        label: subsidiary.name,
        href: subsidiary.href,
        external: true,
      })),
    });
  }

  nav.push({ label: 'Contact Us', href: 'contact' });
  return nav;
}

function buildSchoolsItem(content: SiteContent): SiteNavItem | null {
  const [highSchool, nurseryPrimary] = content.programmes;

  // AB.10's own menu, unchanged: three entries even though two of them lead
  // to the same page, because that is their information architecture and not
  // a tidier one invented for them. Nothing populates `programmes` today
  // except AB.10's own authored content, always in this shape.
  if (highSchool && nurseryPrimary) {
    return {
      label: 'Schools',
      href: `schools/${highSchool.slug}`,
      children: [
        { label: 'High School', href: `schools/${highSchool.slug}` },
        { label: 'Nursery/Primary', href: `schools/${nurseryPrimary.slug}` },
        { label: 'Creche/After School', href: `schools/${nurseryPrimary.slug}` },
        // `platformUrl`, not the bare href: a portal link lands on the
        // authenticated app, which on a real tenant subdomain is a different
        // origin than this menu's own page (`site-header.tsx`'s utility
        // strip resolves the same link the same way).
        ...content.portals.map((portal) => ({
          label: portal.name,
          href: platformUrl(portal.href),
          external: true,
        })),
      ],
    };
  }

  if (content.levels.length > 0) {
    return {
      label: 'What We Offer',
      href: '#becomeastudent',
      children: content.levels.map((level) => ({
        label: level.name,
        href: '#becomeastudent',
      })),
    };
  }

  return null;
}
