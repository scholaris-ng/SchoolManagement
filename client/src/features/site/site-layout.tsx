import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteContentProvider, useSite } from './site-context';
import { SiteHeader } from './components/site-header';
import { SiteFooter } from './components/site-footer';
import { RegistrationSection } from './components/registration-form';
import { SiteUnavailable } from './components/site-unavailable';
import './site.css';

/**
 * The shell every public page renders inside.
 *
 * It sits outside the authenticated `AppShell` on purpose: this route reads the
 * public endpoint only, so no session, tenant header or cached school data is
 * involved and nothing about an enrolled student can reach it (spec section 31).
 */
export function SiteLayout() {
  usePinLightTheme();

  return (
    <SiteContentProvider>
      <SiteFrame />
    </SiteContentProvider>
  );
}

/**
 * Holds `document.documentElement`'s `data-theme` at `light` for as long as a
 * public page is mounted.
 *
 * `ThemeProvider` (`app/providers/theme-provider.tsx`) writes the signed-in
 * user's preference — or the visitor's OS setting, under "system" — onto that
 * same attribute, and it does so with no notion of route: a browser in dark
 * mode reaches this page exactly as it reaches the authenticated app. `site.css`
 * insulates its own tokens from that by never reading `--background` and
 * friends, but a component borrowed from the signed-in design system, such as
 * the phone field's country picker, is built on those tokens and would render
 * dark on this page's light card the moment a visitor's device prefers dark.
 *
 * A `MutationObserver` rather than a plain effect: `ThemeProvider`'s own
 * effect can still fire while this page is open — a live OS theme change, most
 * plausibly — and would overwrite a value set once on mount. Watching the
 * attribute means every such write is caught and put back, for as long as this
 * layout is on screen; the previous value is restored the moment it isn't.
 */
function usePinLightTheme(): void {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = 'light';

    const observer = new MutationObserver(() => {
      if (root.dataset.theme !== 'light') root.dataset.theme = 'light';
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer.disconnect();
      if (previous === undefined) delete root.dataset.theme;
      else root.dataset.theme = previous;
    };
  }, []);
}

function SiteFrame() {
  const { content, loading, error } = useSite();
  const location = useLocation();
  const unavailable = !loading && Boolean(error);

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
    document.title = unavailable ? 'Site unavailable' : `${content.brand.name} — ${content.brand.motto}`;
  }, [unavailable, content.brand.name, content.brand.motto]);

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

  if (unavailable) return <SiteUnavailable error={error} />;

  return (
    <div className="school-site min-h-dvh" style={brandVars}>
      <SiteHeader />
      <main id="site-main">
        {/* Each page is its own chunk; this is the boundary they suspend on. */}
        <Suspense fallback={<div className="min-h-[70vh]" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
      {/* The school ends every page on its registration form; so does this. */}
      <RegistrationSection />
      <SiteFooter />
    </div>
  );
}
