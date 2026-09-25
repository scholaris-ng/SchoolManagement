import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { renderPage } from '@/test/harness';
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

let unreadCount = 0;
let inbox: {
  data: { items: AppNotification[] } | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: ReturnType<typeof vi.fn>;
};
const markRead = vi.fn();
const markAllRead = vi.fn();

vi.mock('./api', () => ({
  useUnreadCounts: () => ({ data: { notifications: unreadCount } }),
  useNotifications: () => inbox,
  useMarkNotificationRead: () => ({ mutate: markRead }),
  useMarkAllNotificationsRead: () => ({ mutate: markAllRead, isPending: false }),
}));

/**
 * A stand-in for Radix's popover: open when told to, closed otherwise, no
 * positioning.
 *
 * The real one is not usable in this suite. Opening it under jsdom makes every
 * later test in the file slower — 30 seconds each by the last, measured — and a
 * user-event click on its trigger alone took about 40. That is Popper's
 * positioning work in an environment with no layout, and it happens to the
 * component as it was before this one changed too. What is under test here is
 * what the panel shows and does, not where the browser puts it.
 */
vi.mock('@radix-ui/react-popover', async () => {
  const React = await import('react');
  const Popover = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
    open: false,
    setOpen: () => {},
  });
  return {
    Root: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: ReactNode;
    }) => (
      <Popover.Provider value={{ open, setOpen: onOpenChange }}>{children}</Popover.Provider>
    ),
    // Only ever used `asChild` in the component.
    Trigger: ({ children }: { children: ReactElement }) => {
      const { open, setOpen } = React.useContext(Popover);
      return React.cloneElement(children, { onClick: () => setOpen(!open) } as object);
    },
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Content: ({ children, className }: { children: ReactNode; className?: string }) =>
      React.useContext(Popover).open ? <div className={className}>{children}</div> : null,
  };
});

const { NotificationBell } = await import('./notification-bell');

/** Where the router says we are, so a click that navigates can be seen doing so. */
function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function openBell() {
  renderPage(
    <>
      <NotificationBell />
      <Where />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: /^notifications/i }));
}

beforeEach(() => {
  unreadCount = 0;
  inbox = {
    data: { items: [] },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
  markRead.mockReset();
  markAllRead.mockReset();
});

describe('NotificationBell', () => {
  it('says how many are new, next to the way to clear them', () => {
    unreadCount = 3;
    inbox.data = { items: [notification()] };
    openBell();

    expect(screen.getByText('3 new')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    expect(markAllRead).toHaveBeenCalled();
  });

  it('offers neither once everything has been read', () => {
    inbox.data = { items: [notification({ readAt: new Date().toISOString() })] };
    openBell();

    expect(screen.queryByText(/^\d+ new$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark all read/i })).not.toBeInTheDocument();
  });

  it('marks an unread notification as such for a screen reader, and leaves a read one plain', () => {
    unreadCount = 1;
    inbox.data = {
      items: [
        notification({ id: 'new', title: 'Fresh one' }),
        notification({ id: 'old', title: 'Old one', readAt: new Date().toISOString() }),
      ],
    };
    openBell();

    expect(screen.getAllByText(/Unread:/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^unread:\s*fresh one/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /old one/i })).not.toHaveTextContent('Unread');
  });

  it('says what kind of thing each one is, except "system", which says nothing', () => {
    inbox.data = {
      items: [
        notification({ id: 'a', category: 'FEE' }),
        notification({ id: 'b', category: 'SYSTEM', title: 'Lesson note submitted for review' }),
      ],
    };
    openBell();

    expect(screen.getByText('Fees')).toBeInTheDocument();
    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('opens what a notification is about, and marks it read on the way', () => {
    unreadCount = 1;
    inbox.data = { items: [notification()] };
    openBell();

    // Anchored: the mark-as-read control beside it names the same notification.
    fireEvent.click(screen.getByRole('button', { name: /^unread:\s*payment receipt submitted/i }));

    expect(markRead).toHaveBeenCalledWith('n1');
    expect(screen.getByTestId('where')).toHaveTextContent('/finance/receipts/r1');
  });

  it('clears one without leaving the page', () => {
    unreadCount = 1;
    inbox.data = { items: [notification()] };
    openBell();

    fireEvent.click(screen.getByRole('button', { name: /mark “payment receipt submitted” as read/i }));

    expect(markRead).toHaveBeenCalledWith('n1');
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
  });

  it('gives a read notification no mark-as-read control', () => {
    inbox.data = { items: [notification({ readAt: new Date().toISOString() })] };
    openBell();

    expect(screen.queryByRole('button', { name: /as read/i })).not.toBeInTheDocument();
  });

  it('reads the list again when it is opened, so it matches the badge', () => {
    openBell();

    expect(inbox.refetch).toHaveBeenCalledTimes(1);
  });

  it('does not pass a failed load off as an empty inbox', () => {
    inbox = { ...inbox, data: undefined, isError: true, error: new Error('boom') };
    openBell();

    expect(screen.getByText('Couldn’t load notifications')).toBeInTheDocument();
    expect(screen.queryByText('Nothing new')).not.toBeInTheDocument();

    inbox.refetch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(inbox.refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps showing what it has if a refresh fails', () => {
    inbox = { ...inbox, data: { items: [notification()] }, isError: true, error: new Error('boom') };
    openBell();

    expect(screen.getByText('Payment receipt submitted')).toBeInTheDocument();
    expect(screen.queryByText('Couldn’t load notifications')).not.toBeInTheDocument();
  });

  it('says there is nothing new when there is nothing', () => {
    openBell();

    expect(screen.getByText('Nothing new')).toBeInTheDocument();
  });
});
