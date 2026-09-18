import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlatformSchool } from '@/types/platform';
import { ActivateSchoolDialog, MAX_ACTIVATION_MONTHS } from './activate-school-dialog';

const DAY = 86_400_000;

const school = (over: Partial<PlatformSchool> = {}): PlatformSchool => ({
  id: 'sch_1',
  name: 'Brightfield Academy',
  code: 'BFA',
  slug: 'brightfield',
  email: 'office@brightfield.example',
  phone: '',
  plan: 'TRIAL',
  endsAt: new Date(Date.now() + 10 * DAY).toISOString(),
  expired: false,
  daysLeft: 10,
  lastActivatedAt: null,
  lastActivatedBy: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  ...over,
});

const onConfirm = vi.fn();
const onOpenChange = vi.fn();

const open = (target: PlatformSchool | null = school(), loading = false) =>
  render(
    <ActivateSchoolDialog school={target} loading={loading} onOpenChange={onOpenChange} onConfirm={onConfirm} />,
  );

const monthsField = () => screen.getByLabelText(/number of months/i) as HTMLInputElement;
const confirm = () => screen.getByRole('button', { name: /^activate( for .+)?$/i });

beforeEach(() => {
  onConfirm.mockReset();
  onOpenChange.mockReset();
});
afterEach(cleanup);

describe('ActivateSchoolDialog', () => {
  it('starts at one month, and says where that leaves the school', () => {
    open();

    expect(monthsField().value).toBe('1');
    expect(confirm()).toHaveTextContent('Activate for 1 month');
    expect(screen.getByText(/access will then run until/i)).toBeInTheDocument();
  });

  it('says a locked school’s months count from today, and an open one’s from after its days left', () => {
    const { unmount } = open(school({ expired: true, daysLeft: 0 }));
    expect(screen.getByText(/switched off right now\. the months you choose count from today/i)).toBeInTheDocument();
    unmount();

    open(school({ daysLeft: 10 }));
    expect(screen.getByText(/they have 10 days left\. the months you choose are added after those/i)).toBeInTheDocument();
  });

  it('shows a different end date for a different number of months', async () => {
    open(school({ expired: true, daysLeft: 0 }));
    const summary = () => screen.getByText(/access will then run until/i).textContent;

    const oneMonth = summary();
    await userEvent.clear(monthsField());
    await userEvent.type(monthsField(), '12');

    expect(summary()).not.toBe(oneMonth);
    expect(confirm()).toHaveTextContent('Activate for 12 months');
  });

  it('counts an open school’s months from the end of its trial, not from today', async () => {
    // Ends 5 Oct 2030; one month on is 5 Nov 2030 — whatever today is.
    open(school({ endsAt: new Date(2030, 9, 5, 12).toISOString(), daysLeft: 400 }));

    expect(screen.getByText(/until 5 Nov 2030/i)).toBeInTheDocument();
  });

  it('picks a common length with one click', async () => {
    open();

    await userEvent.click(screen.getByRole('button', { name: '6 months' }));

    expect(monthsField().value).toBe('6');
    expect(screen.getByRole('button', { name: '6 months' })).toHaveAttribute('aria-pressed', 'true');
    expect(confirm()).toHaveTextContent('Activate for 6 months');
  });

  it('confirms with the number of months chosen', async () => {
    open();
    await userEvent.clear(monthsField());
    await userEvent.type(monthsField(), '24');

    await userEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledWith(24);
  });

  it('confirms with Enter as well', async () => {
    open();
    await userEvent.clear(monthsField());
    await userEvent.type(monthsField(), '3{Enter}');

    expect(onConfirm).toHaveBeenCalledWith(3);
  });

  it.each([
    ['nothing', ''],
    ['zero', '0'],
    ['a negative number', '-2'],
    ['a fraction', '1.5'],
    ['more than the limit', String(MAX_ACTIVATION_MONTHS + 1)],
  ])('will not confirm %s, and says what is wanted instead', async (_label, typed) => {
    open();
    await userEvent.clear(monthsField());
    if (typed) await userEvent.type(monthsField(), typed);

    expect(confirm()).toBeDisabled();
    expect(screen.getByText(/enter a whole number of months, from 1 to 120/i)).toBeInTheDocument();

    await userEvent.type(monthsField(), '{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('accepts the longest the server allows', async () => {
    open();
    await userEvent.clear(monthsField());
    await userEvent.type(monthsField(), String(MAX_ACTIVATION_MONTHS));

    expect(confirm()).toBeEnabled();
  });

  it('starts from one month again for the next school', async () => {
    const { rerender } = open();
    await userEvent.clear(monthsField());
    await userEvent.type(monthsField(), '9');

    rerender(
      <ActivateSchoolDialog
        school={school({ id: 'sch_2', name: 'Other College' })}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(monthsField().value).toBe('1');
  });

  it('renders nothing when there is no school', () => {
    open(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
