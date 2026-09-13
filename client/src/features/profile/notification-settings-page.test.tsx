import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '@/test/harness';
import type { NotificationCategory, NotificationPreference } from '@/types/engagement';

const updateMutate = vi.fn();

const CATEGORIES: NotificationCategory[] = [
  'ATTENDANCE',
  'RESULT',
  'FEE',
  'ADMISSION',
  'CALENDAR',
  'MESSAGE',
  'BEHAVIOUR',
  'COLLECTION',
  'ANNOUNCEMENT',
  'SYSTEM',
];

/**
 * The server still returns every category, MESSAGE and ANNOUNCEMENT included
 * — this proves the page itself hides what has no backend, rather than
 * relying on the server to have stopped sending them.
 */
const ALL_PREFERENCES: NotificationPreference[] = CATEGORIES.map((category) => ({
  category,
  channels: { IN_APP: true, PUSH: true, EMAIL: false, SMS: false },
}));

vi.mock('@/features/notifications/api', () => ({
  useNotificationPreferences: () => ({
    data: ALL_PREFERENCES,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateNotificationPreference: () => ({ mutate: updateMutate, isPending: false }),
  useRegisterPushToken: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { NotificationSettingsPage } = await import('./notification-settings-page');

/**
 * ANNOUNCEMENT and MESSAGE have no backend yet (the engagement module is a
 * placeholder with no write routes) and SMS has no delivery adapter anywhere
 * — see notification-settings-page-constants.ts. All three are commented out
 * of the option lists there rather than deleted, so this page must hide them
 * from what it renders.
 */
describe('NotificationSettingsPage', () => {
  it('shows only categories with a real backend', () => {
    renderPage(<NotificationSettingsPage />);

    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Fees')).toBeInTheDocument();
    expect(screen.getByText('Admissions')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Behaviour')).toBeInTheDocument();
    expect(screen.getByText('Child collection')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();

    expect(screen.queryByText('Announcements')).not.toBeInTheDocument();
    expect(screen.queryByText('Messages')).not.toBeInTheDocument();
  });

  it('offers no SMS column for any category', () => {
    renderPage(<NotificationSettingsPage />);

    expect(screen.queryByRole('switch', { name: /by SMS/ })).not.toBeInTheDocument();
  });

  it('still toggles a channel that does work', async () => {
    const user = userEvent.setup();
    renderPage(<NotificationSettingsPage />);

    await user.click(screen.getByRole('switch', { name: 'Attendance by Email' }));

    expect(updateMutate).toHaveBeenCalledWith({
      category: 'ATTENDANCE',
      channel: 'EMAIL',
      enabled: true,
    });
  });
});
