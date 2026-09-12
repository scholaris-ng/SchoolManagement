import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '@/test/harness';
import type { PublicSchoolPage } from '@/features/public/api';

/**
 * The public site renders from shipped content until a tenant supplies its own.
 *
 * These two behaviours are what make the site safe to ship before the CMS
 * exists: a school with an empty website record still gets a complete page, and
 * the moment it fills a field in, that field wins.
 */

const usePublicSchool = vi.fn();

vi.mock('@/features/public/api', () => ({
  usePublicSchool: (...args: unknown[]) => usePublicSchool(...args),
}));

const { SiteContentProvider } = await import('./site-context');
const { SiteHomePage } = await import('./pages/home-page');
const { SiteProgrammePage } = await import('./pages/programme-page');
const { defaultContent } = await import('./default-content');

function remotePage(): PublicSchoolPage {
  return {
    school: {
      name: 'Brightfield Academy',
      shortName: 'Brightfield',
      branding: { primaryColor: '#4f46e5', accentColor: '#0ea5e9', motto: 'Learn and serve' },
      city: 'Ibadan',
      state: 'Oyo',
    },
    website: {
      schoolId: 'sch_1',
      enabled: true,
      slug: 'brightfield',
      tagline: 'A school for the whole child',
      about: 'Brightfield opened in 2001.',
      mission: 'Teach well.',
      vision: 'Serve widely.',
      admissionsOpen: true,
      contactEmail: 'hello@brightfield.test',
      contactPhone: '+234 700 000 0000',
      address: '12 Ring Road, Ibadan',
      socialLinks: [],
      testimonials: [
        { id: 'tst_1', author: 'Mrs Bello', role: 'Parent', quote: 'They know my daughter by name.' },
      ],
      gallery: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    news: [],
    events: [],
  };
}

function renderHome() {
  return renderPage(
    <SiteContentProvider>
      <SiteHomePage />
    </SiteContentProvider>,
    { route: '/s/ab10', path: '/s/:slug' },
  );
}

describe('public site content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the school's own copy when it has published none through the platform", () => {
    usePublicSchool.mockReturnValue({ data: undefined, isPending: false });

    renderHome();

    expect(
      screen.getByRole('heading', { level: 1, name: defaultContent.hero.slides[0].title }),
    ).toBeInTheDocument();
    expect(screen.getByText(defaultContent.testimonials.items[0].author)).toBeInTheDocument();
    expect(screen.getByText(defaultContent.facilities.title)).toBeInTheDocument();
  });

  it('prefers content published through the platform over the shipped copy', () => {
    usePublicSchool.mockReturnValue({ data: remotePage(), isPending: false });

    renderHome();

    expect(screen.getByText('Mrs Bello')).toBeInTheDocument();
    expect(screen.queryByText(defaultContent.testimonials.items[0].author)).not.toBeInTheDocument();
  });

  it('resolves a school section from its slug', () => {
    usePublicSchool.mockReturnValue({ data: undefined, isPending: false });

    renderPage(
      <SiteContentProvider>
        <SiteProgrammePage />
      </SiteContentProvider>,
      { route: '/s/ab10/schools/high-school', path: '/s/:slug/schools/:programme' },
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'AB.10 Schools High School' }),
    ).toBeInTheDocument();
  });
});
