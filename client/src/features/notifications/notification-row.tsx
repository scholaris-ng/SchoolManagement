import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  CreditCard,
  Gavel,
  Megaphone,
  MessageSquare,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { AppNotification, NotificationCategory } from '@/types/engagement';

/**
 * One notification, as the bell's popover and the full inbox page both draw it.
 * Kept in one place so the two never drift apart in how they show urgency or
 * what is unread.
 */

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

/** Said beside the time, so a row says what kind of thing it is before it is read. "System" says nothing, so it is left out. */
const CATEGORY_LABEL: Partial<Record<NotificationCategory, string>> = {
  ATTENDANCE: 'Attendance',
  RESULT: 'Results',
  FEE: 'Fees',
  ADMISSION: 'Admissions',
  CALENDAR: 'Calendar',
  MESSAGE: 'Messages',
  BEHAVIOUR: 'Behaviour',
  COLLECTION: 'Collection',
  ANNOUNCEMENT: 'Announcements',
};

/**
 * Urgency always shows in colour. Otherwise the icon is what tells unread from
 * read: lit for something new, grey once it has been dealt with.
 */
function iconTone(notification: AppNotification, unread: boolean): string {
  const tone =
    notification.severity === 'CRITICAL'
      ? 'bg-danger-subtle text-danger'
      : notification.severity === 'WARNING'
        ? 'bg-warning-subtle text-warning'
        : notification.severity === 'SUCCESS'
          ? 'bg-success-subtle text-success'
          : unread
            ? 'bg-primary-subtle text-primary dark:text-white'
            : 'bg-muted text-muted-foreground';
  return unread ? tone : cn(tone, 'opacity-70');
}

export function NotificationRow({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  onMarkRead: (id: string) => void;
}) {
  const unread = !notification.readAt;
  const Icon = CATEGORY_ICON[notification.category] ?? Bell;
  const category = CATEGORY_LABEL[notification.category];

  return (
    <li className="group relative">
      {unread && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />
      )}

      <button
        type="button"
        data-cy={`notification-${notification.id}`}
        onClick={() => onOpen(notification)}
        // Inset: the app-wide focus ring is a box-shadow that a parent's
        // `overflow-hidden` (the popover, the inbox card) would clip along the
        // row's edges.
        className="flex w-full items-start gap-3 py-3 pl-4 pr-12 text-left transition-colors hover:bg-accent focus-visible:ring-inset focus-visible:ring-offset-0"
      >
        <span
          className={cn(
            'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full',
            iconTone(notification, unread),
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {/* Unread is a heavier title as well as a marker: a row a colourblind
              reader can't pick out by its dot alone still stands out. */}
          <p
            className={cn(
              'text-sm leading-snug',
              unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
            )}
          >
            {unread && <span className="sr-only">Unread: </span>}
            {notification.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {category && (
              <>
                <span>{category}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <time dateTime={notification.createdAt} title={formatDateTime(notification.createdAt)}>
              {formatRelative(notification.createdAt)}
            </time>
          </p>
        </div>
      </button>

      {/* The dot is also the way to clear one without opening it: on hover or
          focus it turns into a tick. */}
      {unread && (
        <button
          type="button"
          data-cy={`notification-mark-read-${notification.id}`}
          onClick={() => onMarkRead(notification.id)}
          aria-label={`Mark “${notification.title}” as read`}
          title="Mark as read"
          className="absolute right-3 top-3 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:ring-inset focus-visible:ring-offset-0"
        >
          <span
            className="size-2 rounded-full bg-primary group-focus-within:hidden group-hover:hidden"
            aria-hidden="true"
          />
          <Check
            className="hidden size-3.5 group-focus-within:block group-hover:block"
            aria-hidden="true"
          />
        </button>
      )}
    </li>
  );
}
