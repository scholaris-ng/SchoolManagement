import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { authStub, buildMembership } from '@/test/harness';
import type { SchoolAccess } from '@/types/tenant';

let stub = authStub([]);
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => stub,
}));

const { SchoolPlanBadge } = await import('./school-plan-badge');

const access = (over: Partial<SchoolAccess> = {}): SchoolAccess => ({
  plan: 'TRIAL',
  endsAt: '2026-10-02T12:00:00.000Z',
  expired: false,
  daysLeft: 12,
  contactEmail: 'admin@scholaris.test',
  ...over,
});

/** Signs in to a school in this state, as this kind of person. */
function signedInWith(school: Partial<SchoolAccess>, person: { canManageSubscriptions?: boolean } = {}) {
  const membership = buildMembership({ access: access(school) });
  const base = authStub([]);
  stub = {
    ...base,
    membership,
    memberships: [membership],
    user: { ...base.user, ...person, memberships: [membership] },
  };
}

afterEach(cleanup);

describe('SchoolPlanBadge', () => {
  it('shows the school, its plan and how long a trial has left', () => {
    signedInWith({ plan: 'TRIAL', daysLeft: 12 });
    render(<SchoolPlanBadge />);

    expect(screen.getByText('Brightfield')).toBeInTheDocument();
    expect(screen.getByText('Free trial')).toBeInTheDocument();
    expect(screen.getByText('12 days left')).toBeInTheDocument();
    expect(screen.queryByText(/contact admin/i)).not.toBeInTheDocument();
  });

  it('shows an active school’s plan and the date it runs to', () => {
    signedInWith({ plan: 'ACTIVE', endsAt: '2026-10-18T12:00:00.000Z', daysLeft: 28 });
    render(<SchoolPlanBadge />);

    expect(screen.getByText('Active plan')).toBeInTheDocument();
    expect(screen.getByText('Valid until 18 Oct 2026')).toBeInTheDocument();
  });

  it('warns in the last few days, and reads the singular correctly on the last one', () => {
    signedInWith({ daysLeft: 1 });
    render(<SchoolPlanBadge />);

    const pill = screen.getByText('1 day left');
    expect(pill.className).toContain('text-warning');
  });

  it('turns into the one button that matters once a school’s trial has ended', () => {
    signedInWith({ expired: true, daysLeft: 0 });
    render(<SchoolPlanBadge />);

    const button = screen.getByRole('link', { name: /contact admin to activate/i });
    expect(button).toHaveAttribute('href', expect.stringMatching(/^mailto:admin@scholaris\.test\?/));
    expect(button).toHaveTextContent('Trial ended');
    expect(screen.queryByText('Free trial')).not.toBeInTheDocument();
  });

  it('asks for a renewal, not an activation, when a paid month has run out', () => {
    signedInWith({ plan: 'ACTIVE', expired: true, daysLeft: 0 });
    render(<SchoolPlanBadge />);

    const button = screen.getByRole('link', { name: /contact admin to renew/i });
    expect(button).toHaveTextContent('Subscription ended');
  });

  it('still says what happened when no administrator address is configured', () => {
    signedInWith({ expired: true, daysLeft: 0, contactEmail: null });
    render(<SchoolPlanBadge />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/trial ended · contact your administrator to activate/i)).toBeInTheDocument();
  });

  it('shows an administrator their own lapsed school as information, not a lock', () => {
    signedInWith({ expired: true, daysLeft: 0 }, { canManageSubscriptions: true });
    render(<SchoolPlanBadge />);

    expect(screen.getByText(/^Ended /)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /contact admin/i })).not.toBeInTheDocument();
  });

  it('shows nothing from an API that predates subscriptions', () => {
    const membership = buildMembership();
    delete (membership as { access?: unknown }).access;
    stub = { ...authStub([]), membership, memberships: [membership] };
    const { container } = render(<SchoolPlanBadge />);

    expect(container).toBeEmptyDOMElement();
  });
});
