import { env } from '@/lib/env';

/**
 * The public site is reached at `<address>.<platform domain>` (spec section
 * 31) — `abschool.scholaris.app`, or `abschool.localhost:5173` in
 * development — never at a path on the platform's own domain. `VITE_APP_URL`
 * is that platform domain, so it's the one fixed point everything here is
 * read against; the browser's current host is the only thing that varies.
 */

/** The platform's own domain, with port — `localhost:5173` in development. */
function rootHost(): string | null {
  try {
    return new URL(env.appUrl).host || null;
  } catch {
    return null;
  }
}

/**
 * The tenant slug the page is being served for, or `null` on the platform's
 * own domain — where the authenticated app renders instead of a school's
 * site. Takes the host explicitly rather than always reading
 * `window.location` so it stays trivial to test.
 */
export function siteSlugFromHost(host: string = window.location.host): string | null {
  const root = rootHost();
  if (!root || host === root || !host.endsWith(`.${root}`)) return null;
  return host.slice(0, -(root.length + 1)) || null;
}

/**
 * The absolute, browsable address of a school's site, given its slug — the
 * subdomain form. Needs a real, owned domain with wildcard DNS in front of
 * it to actually resolve, which isn't set up yet, so nothing links to this
 * one in the UI until that's done; `sitePathUrlForSlug` is what's live.
 */
export function siteUrlForSlug(slug: string): string {
  const url = new URL(env.appUrl);
  url.hostname = `${slug}.${url.hostname}`;
  return url.origin;
}

/** The `/s/:slug` address a school's site is reached at today, on any host. */
export function sitePathUrlForSlug(slug: string): string {
  return `${env.appUrl.replace(/\/$/, '')}/s/${slug}`;
}

/**
 * An absolute link onto the platform app itself — sign-in, sign-up, and the
 * like. A plain `<a>` to this, not a `<Link>`, because on a real tenant
 * subdomain the authenticated app lives on a different origin entirely and
 * isn't in this page's own router (`site.routes.tsx`); a full navigation is
 * what actually gets a visitor there, on any address the site is reached at.
 */
export function platformUrl(path: string): string {
  return `${env.appUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
