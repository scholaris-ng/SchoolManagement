import { describe, expect, it } from 'vitest';
import type { SchoolAccess } from '@/types/tenant';
import { isNavItemVisible } from '@/app/navigation';
import { activationMailto, isLocked, viewAccess } from './school-access';

const access = (over: Partial<SchoolAccess> = {}): SchoolAccess => ({
  plan: 'TRIAL',
  endsAt: '2026-10-02T12:00:00.000Z',
  expired: false,
  daysLeft: 12,
  contactEmail: 'admin@scholaris.test',
  ...over,
});

describe('viewAccess', () => {
  it('is calm with days to spare', () => {
    expect(viewAccess(access({ daysLeft: 12 })).warn).toBe(false);
  });

  it('warns from three days out, and on the last day', () => {
    expect(viewAccess(access({ daysLeft: 4 })).warn).toBe(false);
    expect(viewAccess(access({ daysLeft: 3 })).warn).toBe(true);
    expect(viewAccess(access({ daysLeft: 1 })).warn).toBe(true);
  });

  it('does not warn once it has ended — that is a different state, not a louder warning', () => {
    expect(viewAccess(access({ expired: true, daysLeft: 0 })).warn).toBe(false);
  });
});

describe('isLocked', () => {
  const person = { canManageSubscriptions: false, isPlatformAdmin: false };
  const ended = { access: access({ expired: true, daysLeft: 0 }) };
  const open = { access: access() };

  it('locks a school’s people once it has ended', () => {
    expect(isLocked(person, ended)).toBe(true);
  });

  it('leaves an open school alone', () => {
    expect(isLocked(person, open)).toBe(false);
  });

  it('never locks the people who activate schools, or the platform operator', () => {
    expect(isLocked({ ...person, canManageSubscriptions: true }, ended)).toBe(false);
    expect(isLocked({ ...person, isPlatformAdmin: true }, ended)).toBe(false);
  });

  it('locks nobody before there is a person and a school to speak of', () => {
    expect(isLocked(null, ended)).toBe(false);
    expect(isLocked(person, null)).toBe(false);
  });

  it('treats a session without `access` as open, so a client ahead of its API does not crash', () => {
    expect(isLocked(person, {} as { access: SchoolAccess })).toBe(false);
  });
});

describe('activationMailto', () => {
  const url = activationMailto({
    to: 'admin@scholaris.test',
    schoolName: 'Brightfield Academy',
    schoolSlug: 'brightfield',
    userEmail: 'ada@brightfield.edu.ng',
    plan: 'TRIAL',
  });

  it('writes to the administrator, ready to send', () => {
    expect(url.startsWith('mailto:admin@scholaris.test?')).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('subject')).toBe('Activate Brightfield Academy');
    expect(params.get('body')).toContain('Brightfield Academy');
    expect(params.get('body')).toContain('brightfield');
    expect(params.get('body')).toContain('ada@brightfield.edu.ng');
  });

  it('asks for a renewal, not an activation, from a school that has paid before', () => {
    const renewal = new URL(
      activationMailto({ to: 'a@b.test', schoolName: 'Brightfield Academy', schoolSlug: 'b', plan: 'ACTIVE' }),
    ).searchParams;
    expect(renewal.get('subject')).toBe('Renew Brightfield Academy');
  });

  it('keeps a school name with awkward characters from breaking the link', () => {
    const tricky = activationMailto({
      to: 'a@b.test',
      schoolName: 'St. Mary & Sons, "Best" School?',
      schoolSlug: 'st-marys',
      plan: 'TRIAL',
    });
    expect(new URL(tricky).searchParams.get('subject')).toBe('Activate St. Mary & Sons, "Best" School?');
  });
});

describe('isNavItemVisible', () => {
  it('shows an ordinary entry to everyone', () => {
    expect(isNavItemVisible({}, null)).toBe(true);
    expect(isNavItemVisible({}, { canManageSubscriptions: false })).toBe(true);
  });

  it('shows an administrators-only entry only to them', () => {
    expect(isNavItemVisible({ subscriptionAdminOnly: true }, { canManageSubscriptions: true })).toBe(true);
    expect(isNavItemVisible({ subscriptionAdminOnly: true }, { canManageSubscriptions: false })).toBe(false);
    expect(isNavItemVisible({ subscriptionAdminOnly: true }, null)).toBe(false);
  });
});
