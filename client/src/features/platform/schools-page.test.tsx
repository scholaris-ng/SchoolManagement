import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '@/test/harness';
import type { PlatformSchool } from '@/types/platform';

const fetchSchools = vi.fn();
const activateSchool = vi.fn();
vi.mock('./platform.endpoints', () => ({
  PlatformEndpoints: {
    fetchSchools: (...args: unknown[]) => fetchSchools(...args),
    activateSchool: (...args: unknown[]) => activateSchool(...args),
  },
}));

const { PlatformSchoolsPage } = await import('./schools-page');

const DAY = 86_400_000;
const school = (over: Partial<PlatformSchool> = {}): PlatformSchool => ({
  id: 'sch_1',
  name: 'Brightfield Academy',
  code: 'BFA',
  slug: 'brightfield',
  email: 'office@brightfield.example',
  phone: '08030000000',
  plan: 'TRIAL',
  endsAt: new Date(Date.now() + 10 * DAY).toISOString(),
  expired: false,
  daysLeft: 10,
  lastActivatedAt: null,
  lastActivatedBy: null,
  smsCredits: 0,
  createdAt: '2026-09-01T09:00:00.000Z',
  ...over,
});

const locked = school({
  id: 'sch_2',
  name: 'Lapsed College',
  code: 'LAP',
  slug: 'lapsed',
  email: 'hello@lapsed.example',
  endsAt: new Date(Date.now() - 5 * DAY).toISOString(),
  expired: true,
  daysLeft: 0,
});

beforeEach(() => {
  fetchSchools.mockReset().mockResolvedValue([locked, school()]);
  activateSchool.mockReset();
});
afterEach(cleanup);

/** The desktop table and the mobile cards render together; the table is the one under test. */
const rowFor = async (name: string) => {
  const table = await screen.findByRole('table');
  return within(table).getByText(name).closest('tr') as HTMLElement;
};

describe('PlatformSchoolsPage', () => {
  it('lists every school with where it stands, the ones that have lapsed marked as locked', async () => {
    renderPage(<PlatformSchoolsPage />);

    const lapsed = await rowFor('Lapsed College');
    expect(within(lapsed).getByText('Locked')).toBeInTheDocument();
    expect(within(lapsed).getByText(/ended 5 days ago/i)).toBeInTheDocument();

    const trial = await rowFor('Brightfield Academy');
    expect(within(trial).getByText('Free trial')).toBeInTheDocument();
    expect(within(trial).getByText('10 days left')).toBeInTheDocument();
  });

  it('summarises how many are locked and how many are still on trial', async () => {
    renderPage(<PlatformSchoolsPage />);

    expect(await screen.findByText('2 schools')).toBeInTheDocument();
    expect(screen.getByText('1 locked')).toBeInTheDocument();
    expect(screen.getByText('1 on trial')).toBeInTheDocument();
  });

  it('narrows the list by name, code or email', async () => {
    renderPage(<PlatformSchoolsPage />);
    await rowFor('Lapsed College');

    await userEvent.type(screen.getByLabelText(/search schools/i), 'hello@lapsed');

    const table = screen.getByRole('table');
    expect(within(table).getByText('Lapsed College')).toBeInTheDocument();
    expect(within(table).queryByText('Brightfield Academy')).not.toBeInTheDocument();
  });

  it('asks before activating, and says what will happen to a locked school', async () => {
    renderPage(<PlatformSchoolsPage />);
    const row = await rowFor('Lapsed College');

    await userEvent.click(within(row).getByRole('button', { name: /^activate$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Activate Lapsed College')).toBeInTheDocument();
    expect(within(dialog).getByText(/switched off right now/i)).toBeInTheDocument();
    expect(activateSchool).not.toHaveBeenCalled();
  });

  it('says that the months are added after what an open school has left', async () => {
    renderPage(<PlatformSchoolsPage />);
    const row = await rowFor('Brightfield Academy');

    await userEvent.click(within(row).getByRole('button', { name: /^activate$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/they have 10 days left/i)).toBeInTheDocument();
  });

  it('activates the school that was chosen for one month unless told otherwise, then reads the list again', async () => {
    activateSchool.mockResolvedValue(
      school({ id: 'sch_2', name: 'Lapsed College', plan: 'ACTIVE', expired: false, daysLeft: 30 }),
    );
    renderPage(<PlatformSchoolsPage />);
    const row = await rowFor('Lapsed College');
    await userEvent.click(within(row).getByRole('button', { name: /^activate$/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^activate for 1 month$/i }));

    await waitFor(() => expect(activateSchool).toHaveBeenCalledWith('sch_2', 1));
    await waitFor(() => expect(fetchSchools).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('activates for however many months were chosen', async () => {
    activateSchool.mockResolvedValue(school({ id: 'sch_2', name: 'Lapsed College', plan: 'ACTIVE' }));
    renderPage(<PlatformSchoolsPage />);
    const row = await rowFor('Lapsed College');
    await userEvent.click(within(row).getByRole('button', { name: /^activate$/i }));

    const dialog = await screen.findByRole('dialog');
    const months = within(dialog).getByLabelText(/number of months/i);
    await userEvent.clear(months);
    await userEvent.type(months, '18');
    await userEvent.click(within(dialog).getByRole('button', { name: /^activate for 18 months$/i }));

    await waitFor(() => expect(activateSchool).toHaveBeenCalledWith('sch_2', 18));
  });

  it('says so when there are no schools', async () => {
    fetchSchools.mockResolvedValue([]);
    renderPage(<PlatformSchoolsPage />);

    expect(await screen.findByText('No schools yet')).toBeInTheDocument();
  });
});
