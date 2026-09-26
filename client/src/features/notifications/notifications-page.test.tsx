import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderPage } from '@/test/harness';
import type { ListQuery, PageMeta } from '@/types/api';
import type { AppNotification } from '@/types/engagement';

const notification = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  schoolId: 'sch_1',
  category: 'FEE',
  title: 'Payment receipt submitted',
  body: 'Gideon Edo submitted a receipt for ₦197,500.',
  actionUrl: '/finance/receipts/r1',
  readAt: null,
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  severity: 'INFO',
  ...over,
});

const meta = (over: Partial<PageMeta> = {}): PageMeta => ({
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
  ...over,
});

let unreadCount = 0;
let lastQuery: ListQuery | undefined;
let inbox: {
  data: { items: AppNotification[]; meta: PageMeta } | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: ReturnType<typeof vi.fn>;
};
const markRead = vi.fn();
const markAllRead = vi.fn();

vi.mock('./api', () => ({
  useUnreadCounts: () => ({ data: { notifications: unreadCount } }),
  useNotifications: (query: ListQuery) => {
    lastQuery = query;
    return inbox;
  },
  useMarkNotificationRead: () => ({ mutate: markRead }),
  useMarkAllNotificationsRead: () => ({ mutate: markAllRead, isPending: false }),
}));

const { NotificationsPage } = await import('./notifications-page');

/** Where the router says we are, so a click that navigates can be seen doing so. */
function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderInbox(route = '/notifications') {
  return renderPage(
    <>
      <NotificationsPage />
      <Where />
    </>,
    { route },
  );
}

beforeEach(() => {
  unreadCount = 0;
  lastQuery = undefined;
  inbox = {
    data: { items: [notification()], meta: meta() },
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
  markRead.mockReset();
  markAllRead.mockReset();
});

/**
 * The bell's "View all notifications" button pointed at `/notifications`, a
 * route that did not exist — it landed on the not-found page.
 */
describe('NotificationsPage', () => {
  it('lists the notifications, saying what kind of thing each one is', () => {
    inbox.data = {
      items: [
        notification({ id: 'a', category: 'FEE', title: 'Payment receipt submitted' }),
        notification({ id: 'b', category: 'ATTENDANCE', title: 'Absence recorded today' }),
      ],
      meta: meta({ total: 2 }),
    };
    renderInbox();

    expect(screen.getByText('Payment receipt submitted')).toBeInTheDocument();
    expect(screen.getByText('Absence recorded today')).toBeInTheDocument();
    expect(screen.getByText('Fees')).toBeInTheDocument();
    expect(screen.getByText('Attendance')).toBeInTheDocument();
  });

  it('asks the server for the unread ones when the address says so', () => {
    renderInbox('/notifications?status=unread');

    expect(lastQuery).toMatchObject({ page: 1, status: 'unread' });
  });

  it('opens what a notification is about, and marks it read on the way', () => {
    unreadCount = 1;
    renderInbox();

    fireEvent.click(screen.getByRole('button', { name: /^unread:\s*payment receipt submitted/i }));

    expect(markRead).toHaveBeenCalledWith('n1');
    expect(screen.getByTestId('where')).toHaveTextContent('/finance/receipts/r1');
  });

  it('marks a notification with nowhere to go as read without leaving the page', () => {
    inbox.data = {
      items: [notification({ actionUrl: null })],
      meta: meta(),
    };
    renderInbox();

    fireEvent.click(screen.getByRole('button', { name: /^unread:\s*payment receipt submitted/i }));

    expect(markRead).toHaveBeenCalledWith('n1');
    expect(screen.getByTestId('where')).toHaveTextContent('/notifications');
  });

  it('offers "Mark all read" only while something is unread', () => {
    unreadCount = 2;
    const { unmount } = renderInbox();

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    expect(markAllRead).toHaveBeenCalled();
    unmount();

    unreadCount = 0;
    renderInbox();
    expect(screen.queryByRole('button', { name: /mark all read/i })).not.toBeInTheDocument();
  });

  it('links through to the notification settings', () => {
    renderInbox();

    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/profile/notifications',
    );
  });

  it('says there is nothing, differently for an empty inbox and an empty filter', () => {
    inbox.data = { items: [], meta: meta({ total: 0 }) };
    const { unmount } = renderInbox();
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    unmount();

    renderInbox('/notifications?status=read');
    expect(screen.getByText('No notifications match those filters')).toBeInTheDocument();
  });

  it('does not pass a failed load off as an empty inbox', () => {
    inbox = { ...inbox, data: undefined, isError: true, error: new Error('boom') };
    renderInbox();

    expect(screen.getByText('Couldn’t load notifications')).toBeInTheDocument();
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();

    inbox.refetch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(inbox.refetch).toHaveBeenCalledTimes(1);
  });

  it('pages through the inbox', () => {
    inbox.data = { items: [notification()], meta: meta({ total: 60, totalPages: 3, hasNext: true }) };
    renderInbox();

    expect(screen.getByText('60')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(lastQuery).toMatchObject({ page: 2 });
  });
});
