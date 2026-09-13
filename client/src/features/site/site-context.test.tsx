import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '@/test/harness';

/**
 * Two addresses reach the same site: a tenant's own subdomain (the eventual
 * shape, spec section 31) and `/s/:slug` (what actually resolves today, on
 * any host — see `site.routes.tsx`). `path()` has to produce a link that
 * stays on whichever one the visitor is already on, so this pins both.
 */

const usePublicSchool = vi.fn();
const siteSlugFromHost = vi.fn();

vi.mock('@/features/public/api', () => ({
  usePublicSchool: (...args: unknown[]) => usePublicSchool(...args),
}));
vi.mock('./site-host', () => ({ siteSlugFromHost: (...args: unknown[]) => siteSlugFromHost(...args) }));

const { SiteContentProvider, useSite } = await import('./site-context');

function PathProbe() {
  const { path } = useSite();
  return <div data-testid="probe">{path('schools/high-school')}</div>;
}

describe('SiteContentProvider path()', () => {
  beforeEach(() => {
    usePublicSchool.mockReturnValue({ data: undefined, isPending: false });
  });

  it('links bare, with no slug segment, when the host names the tenant', () => {
    siteSlugFromHost.mockReturnValue('ab10');

    renderPage(
      <SiteContentProvider>
        <PathProbe />
      </SiteContentProvider>,
    );

    expect(screen.getByTestId('probe')).toHaveTextContent('/schools/high-school');
  });

  it('keeps the /s/:slug prefix when the host names no tenant', () => {
    siteSlugFromHost.mockReturnValue(null);

    renderPage(
      <SiteContentProvider>
        <PathProbe />
      </SiteContentProvider>,
      { route: '/s/brightfield', path: '/s/:slug' },
    );

    expect(screen.getByTestId('probe')).toHaveTextContent('/s/brightfield/schools/high-school');
  });
});
