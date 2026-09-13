import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { appUrl: 'http://localhost:5173' } }));

const { siteSlugFromHost, siteUrlForSlug } = await import('./site-host');

describe('siteSlugFromHost', () => {
  it('reads the tenant slug off a subdomain of the platform host', () => {
    expect(siteSlugFromHost('abschool.localhost:5173')).toBe('abschool');
  });

  it('is null on the platform host itself, where the authenticated app renders', () => {
    expect(siteSlugFromHost('localhost:5173')).toBeNull();
  });

  it('is null on an unrelated host', () => {
    expect(siteSlugFromHost('example.com')).toBeNull();
  });
});

describe('siteUrlForSlug', () => {
  it('builds the absolute address a school’s site is reached at', () => {
    expect(siteUrlForSlug('abschool')).toBe('http://abschool.localhost:5173');
  });
});
