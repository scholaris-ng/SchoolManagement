import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteContentProvider, useSite } from './site-context';
import { SiteHeader } from './components/site-header';
import { SiteFooter } from './components/site-footer';
import './site.css';

/**
 * The shell every public page renders inside.
 *
 * It sits outside the authenticated `AppShell` on purpose: this route reads the
 * public endpoint only, so no session, tenant header or cached school data is
 * involved and nothing about an enrolled student can reach it (spec section 31).
 */
export function SiteLayout() {
  return (
    <SiteContentProvider>
      <SiteFrame />
    </SiteContentProvider>
  );
}

function SiteFrame() {
  const { content } = useSite();
  const location = useLocation();

  // Publish the school's brand colours as custom properties. Everything in
  // `site.css` reads these, which is what lets one tenant's palette differ from
  // another's without a rebuild.
  const brandVars = {
    '--site-brand': content.brand.colors.brand,
    '--site-brand-dark': content.brand.colors.brandDark,
    '--site-brand-soft': content.brand.colors.brandSoft,
    '--site-accent': content.brand.colors.accent,
    '--site-gold': content.brand.colors.gold,
  } as React.CSSProperties;

  useEffect(() => {
    document.title = `${content.brand.name} — ${content.brand.tagline}`;
  }, [content.brand.name, content.brand.tagline]);

  // Fresh navigations start at the top; a link carrying a hash scrolls to its
  // target once the destination page has rendered.
  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash]);

  return (
    <div className="school-site min-h-dvh" style={brandVars}>
      <SiteHeader />
      <main id="site-main">
        {/* Each page is its own chunk; this is the boundary they suspend on. */}
        <Suspense fallback={<div className="min-h-[70vh]" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
