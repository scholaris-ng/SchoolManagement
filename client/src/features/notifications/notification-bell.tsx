import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types/engagement';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/primitives';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCounts } from './api';
import { NotificationRow } from './notification-row';

type InboxTab = 'read' | 'unread';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>('unread');
  const navigate = useNavigate();
  const counts = useUnreadCounts();
  // Fetched once; "Read" vs "Unread" is a client-side filter over this same
  // page rather than a second network call — the popover only ever shows a
  // handful of items, so there's nothing to gain from asking the server twice.
  const notifications = useNotifications({ page: 1, pageSize: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = counts.data?.notifications ?? 0;

  const allItems = useMemo(() => notifications.data?.items ?? [], [notifications.data]);
  const unreadItems = useMemo(() => allItems.filter((item) => !item.readAt), [allItems]);
  const readItems = useMemo(() => allItems.filter((item) => Boolean(item.readAt)), [allItems]);
  const visibleItems = tab === 'unread' ? unreadItems : readItems;

  // Held in a ref so the effect below runs when the panel opens, and only then.
  const refetchInbox = useRef(notifications.refetch);
  refetchInbox.current = notifications.refetch;

  // The badge polls every minute but the list only moves when something
  // invalidates it, so a badge that says 4 could open onto a list of 3. Read
  // again on the way in; what is already showing stays put while it does.
  useEffect(() => {
    if (open) void refetchInbox.current();
  }, [open]);

  // Reopening always starts on "Unread" — that's the thing a user came here
  // to check.
  useEffect(() => {
    if (open) setTab('unread');
  }, [open]);

  const openNotification = (notification: AppNotification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-cy="notification-bell"
          className="relative grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-[1rem] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-danger-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border bg-popover shadow-popover animate-in"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <span
                  data-cy="notifications-unread-count"
                  className="rounded-full bg-primary-subtle px-2 py-0.5 text-[11px] font-semibold text-primary dark:text-white"
                >
                  {unread > 99 ? '99+' : unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                data-cy="notifications-mark-all-read"
                className="h-7 text-xs"
                onClick={() => markAllRead.mutate()}
                loading={markAllRead.isPending}
              >
                <CheckCheck />
                Mark all read
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 border-b border-border px-2 pt-2" role="tablist" aria-label="Filter notifications">
            <TabButton active={tab === 'unread'} onClick={() => setTab('unread')} dataCy="notifications-tab-unread">
              Unread
              {unreadItems.length > 0 && (
                <span
                  className={cn(
                    'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                    tab === 'unread' ? 'bg-primary-subtle text-primary dark:text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {unreadItems.length > 99 ? '99+' : unreadItems.length}
                </span>
              )}
            </TabButton>
            <TabButton active={tab === 'read'} onClick={() => setTab('read')} dataCy="notifications-tab-read">
              Read
            </TabButton>
          </div>

          <div className="scrollbar-thin max-h-[26rem] overflow-y-auto">
            {notifications.isPending ? (
              <div className="space-y-4 p-4" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.isError && !notifications.data ? (
              // A failed load is not an empty inbox, and must not read as one.
              <ErrorState
                compact
                data-cy="notifications-error"
                title="Couldn’t load notifications"
                error={notifications.error}
                onRetry={() => void notifications.refetch()}
              />
            ) : visibleItems.length === 0 ? (
              <EmptyState
                compact
                icon={<Bell />}
                title={tab === 'unread' ? 'All caught up' : 'Nothing read yet'}
                description={
                  tab === 'unread'
                    ? 'You have no unread notifications.'
                    : 'Notifications you\u2019ve opened or marked as read will appear here.'
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {visibleItems.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={openNotification}
                    onMarkRead={(id) => markRead.mutate(id)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              block
              asChild
              data-cy="notifications-view-all"
              onClick={() => setOpen(false)}
            >
              <Link to="/notifications">View all notifications</Link>
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function TabButton({
  active,
  onClick,
  dataCy,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dataCy: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-cy={dataCy}
      onClick={onClick}
      className={cn(
        'flex items-center rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-b-2 border-primary text-foreground'
          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
