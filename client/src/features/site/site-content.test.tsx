import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '@/test/harness';
import type { PublicSchoolPage } from '@/features/public/api';

/**
 * How a public site resolves its content.
 *
 * Three behaviours matter here. A tenant the platform does not yet have real
 * copy for renders the neutral floor, not AB.10's own site copy — that mix-up
 * is the bug `site-context.tsx`'s `AB10_SLUG` exists to prevent, and it is
 * specifically what the first test below guards. AB.10 itself keeps rendering
 * its own real copy, since its `WebsiteContent` row holds almost none of it.
 * And whatever a tenant publishes through the platform overrides the floor
 * field by field, so administrators can take ownership one section at a time.
 */

const usePublicSchool = vi.fn();

vi.mock('@/features/public/api', () => ({
  usePublicSchool: (...args: unknown[]) => usePublicSchool(...args),
}));
vi.mock('./site-host', () => ({ siteSlugFromHost: () => 'ab10' }));

const { SiteContentProvider } = await import('./site-context');
const { SiteHomePage } = await import('./pages/home-page');
const { SiteProgrammePage } = await import('./pages/programme-page');
const { defaultContent } = await import('./default-content');

function brightfieldPage(): PublicSchoolPage {
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
      founder: null,
      values: [],
      leadership: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    news: [],
    events: [],
    levels: [],
  };
}

/** AB.10's own resolved tenant — the one slug that still renders `defaultContent`. */
function ab10Page(): PublicSchoolPage {
  return {
    school: {
      name: 'AB.10 Schools',
      shortName: 'AB.10',
      branding: { primaryColor: '#16307A', accentColor: '#C62031', motto: 'Knowledge, Godliness & Greatness' },
      city: 'Lagos',
      state: 'Lagos',
    },
    website: {
      schoolId: 'sch_ab10',
      enabled: true,
      // The one value `site-context.tsx`'s `AB10_SLUG` matches against.
      slug: 'ab10schools',
      tagline: '',
      about: '',
      mission: '',
      vision: '',
      admissionsOpen: true,
      contactEmail: 'ab10schoolsifako@gmail.com',
      contactPhone: '+2348063219815',
      address: '',
      socialLinks: [],
      testimonials: [],
      gallery: [],
      founder: null,
      values: [],
      leadership: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    news: [],
    events: [],
    levels: [],
  };
}

function renderHome() {
  return renderPage(
    <SiteContentProvider>
      <SiteHomePage />
    </SiteContentProvider>,
  );
}

describe('public site content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a neutral floor for a tenant AB.10's copy does not belong to, not AB.10's own content", () => {
    usePublicSchool.mockReturnValue({ data: undefined, isPending: false });

    renderHome();

    // The neutral floor's own hero, not AB.10's.
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
    // Sections with nothing to show (AB.10's testimonials, AB.10's facilities
    // grid) are absent entirely rather than showing with someone else's copy.
    expect(screen.queryByText(defaultContent.testimonials.items[0].author)).not.toBeInTheDocument();
    expect(screen.queryByText(defaultContent.facilities.title)).not.toBeInTheDocument();
  });

  it('renders AB.10 Schools’ own copy once the resolved tenant is AB.10 itself', () => {
    usePublicSchool.mockReturnValue({ data: ab10Page(), isPending: false });

    renderHome();

    expect(
      screen.getByRole('heading', { level: 1, name: defaultContent.hero.slides[0].title }),
    ).toBeInTheDocument();
    expect(screen.getByText(defaultContent.testimonials.items[0].author)).toBeInTheDocument();
    expect(screen.getByText(defaultContent.facilities.title)).toBeInTheDocument();
  });

  it('prefers content published through the platform over the neutral floor', () => {
    usePublicSchool.mockReturnValue({ data: brightfieldPage(), isPending: false });

    renderHome();

    expect(screen.getByText('Mrs Bello')).toBeInTheDocument();
    expect(screen.queryByText(defaultContent.testimonials.items[0].author)).not.toBeInTheDocument();
  });

  it("resolves a school section from its slug, for AB.10's own authored programmes", () => {
    usePublicSchool.mockReturnValue({ data: ab10Page(), isPending: false });

    renderPage(
      <SiteContentProvider>
        <SiteProgrammePage />
      </SiteContentProvider>,
      { route: '/schools/high-school', path: '/schools/:programme' },
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'AB.10 Schools High School' }),
    ).toBeInTheDocument();
  });

  it('sends a tenant with no authored programmes home instead of crashing on the route', () => {
    usePublicSchool.mockReturnValue({ data: brightfieldPage(), isPending: false });

    renderPage(
      <SiteContentProvider>
        <SiteProgrammePage />
      </SiteContentProvider>,
      { route: '/schools/high-school', path: '/schools/:programme' },
    );

    // Redirected away from a page Brightfield has never written, rather than
    // reading `content.programmes[0]` of an empty array.
    expect(screen.queryByRole('heading', { level: 1 })).not.toHaveTextContent('AB.10');
  });
});
