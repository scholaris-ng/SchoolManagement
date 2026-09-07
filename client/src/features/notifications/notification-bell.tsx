import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  CreditCard,
  Gavel,
  Megaphone,
  MessageSquare,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import type { AppNotification, NotificationCategory } from '@/types/engagement';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/primitives';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCounts } from './api';

const CATEGORY_ICON: Record<NotificationCategory, typeof Bell> = {
  ATTENDANCE: ClipboardCheck,
  RESULT: BookOpen,
  FEE: CreditCard,
  ADMISSION: UserPlus,
  CALENDAR: CalendarDays,
  MESSAGE: MessageSquare,
  BEHAVIOUR: Sparkles,
  COLLECTION: Gavel,
  ANNOUNCEMENT: Megaphone,
  SYSTEM: Bell,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const counts = useUnreadCounts();
  const notifications = useNotifications({ page: 1, pageSize: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = counts.data?.notifications ?? 0;

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
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAllRead.mutate()}
                loading={markAllRead.isPending}
              >
                <CheckCheck />
                Mark all read
              </Button>
            )}
          </div>

          <div className="scrollbar-thin max-h-[26rem] overflow-y-auto">
            {notifications.isPending ? (
              <div className="space-y-3 p-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (notifications.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<Bell />}
                title="Nothing new"
                description="Alerts about attendance, results and fees will appear here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {notifications.data?.items.map((notification) => {
                  const Icon = CATEGORY_ICON[notification.category] ?? Bell;
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className={cn(
                          'flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-accent',
                          !notification.readAt && 'bg-primary-subtle/50',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                            notification.severity === 'CRITICAL'
                              ? 'bg-danger-subtle text-danger'
                              : notification.severity === 'WARNING'
                                ? 'bg-warning-subtle text-warning'
                                : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{notification.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {notification.body}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatRelative(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.readAt && (
                          <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-2">
            <Button variant="ghost" size="sm" block asChild onClick={() => setOpen(false)}>
              <Link to="/notifications">View all notifications</Link>
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
