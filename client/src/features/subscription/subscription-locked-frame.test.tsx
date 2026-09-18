import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authStub, buildMembership } from '@/test/harness';
import type { SchoolAccess } from '@/types/tenant';

const refreshSession = vi.fn().mockResolvedValue(undefined);
const switchSchool = vi.fn();
const signOut = vi.fn().mockResolvedValue(undefined);

let stub = authStub([]);
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => stub,
}));

const { SubscriptionLockedFrame } = await import('./subscription-locked-frame');

const ended: SchoolAccess = {
  plan: 'TRIAL',
  endsAt: '2026-09-01T12:00:00.000Z',
  expired: true,
  daysLeft: 0,
  contactEmail: 'admin@scholaris.test',
};
const open: SchoolAccess = { ...ended, expired: false, daysLeft: 20, endsAt: '2099-01-01T00:00:00.000Z' };

function lockedOut(others: SchoolAccess[] = []) {
  const here = buildMembership({ access: ended });
  const elsewhere = others.map((access, index) =>
    buildMembership({
      id: `mem_${index + 2}`,
      schoolId: `sch_${index + 2}`,
      schoolName: `Other School ${index + 1}`,
      schoolShortName: `Other${index + 1}`,
      access,
    }),
  );
  const base = authStub([]);
  stub = {
    ...base,
    membership: here,
    memberships: [here, ...elsewhere],
    user: { ...base.user, memberships: [here, ...elsewhere] },
    refreshSession,
    switchSchool,
    signOut,
  };
}

beforeEach(() => {
  refreshSession.mockClear();
  switchSchool.mockClear();
  signOut.mockClear();
});
afterEach(cleanup);

describe('SubscriptionLockedFrame', () => {
  it('says the trial has ended and that nothing was lost', () => {
    lockedOut();
    render(<SubscriptionLockedFrame />);

    expect(screen.getByRole('heading', { name: /your free trial has ended/i })).toBeInTheDocument();
    expect(screen.getByText(/nothing has been lost/i)).toBeInTheDocument();
    expect(screen.getByText(/access to brightfield academy is paused/i)).toBeInTheDocument();
  });

  it('puts the contact button in the header and again in the message', () => {
    lockedOut();
    render(<SubscriptionLockedFrame />);

    const buttons = screen.getAllByRole('link', { name: /contact admin to activate/i });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveAttribute('href', expect.stringMatching(/^mailto:admin@scholaris\.test\?/));
    }
  });

  it('says a subscription, not a trial, has ended for a school that had paid', () => {
    lockedOut();
    stub = { ...stub, membership: buildMembership({ access: { ...ended, plan: 'ACTIVE' } }) };
    render(<SubscriptionLockedFrame />);

    expect(screen.getByRole('heading', { name: /your subscription has ended/i })).toBeInTheDocument();
  });

  it('checks again on request, and says when it last looked', async () => {
    lockedOut();
    render(<SubscriptionLockedFrame />);

    expect(screen.getByText(/opens by itself once the school is activated/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /check again/i }));

    expect(refreshSession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/still waiting for activation/i)).toBeInTheDocument());
  });

  it('offers another school the person can still work in, and none that is also locked', async () => {
    lockedOut([open, ended]);
    render(<SubscriptionLockedFrame />);

    expect(screen.getByText(/or work in another school/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /other school 2/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /other school 1/i }));
    expect(switchSchool).toHaveBeenCalledWith('sch_2');
  });

  it('offers no other school when there is none to offer', () => {
    lockedOut();
    render(<SubscriptionLockedFrame />);

    expect(screen.queryByText(/or work in another school/i)).not.toBeInTheDocument();
  });

  it('lets the person sign out', async () => {
    lockedOut();
    render(<SubscriptionLockedFrame />);

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });
});
