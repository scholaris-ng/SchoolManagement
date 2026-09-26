import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { useListQuery } from '@/hooks/use-list-query';
import type { AppNotification } from '@/types/engagement';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { FilterBar } from '@/components/data/filter-bar';
import { Pagination } from '@/components/data/pagination';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCounts,
} from './api';
import { NotificationRow } from './notification-row';

const FILTER_KEYS = ['status'];

const STATUS_OPTIONS = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

/**
 * Everything the school has told you, not just the last handful the bell's
 * popover has room for — the page its "View all notifications" button opens.
 *
 * The unread/read filter is applied by the server, so it holds across pages;
 * the popover can filter its one page client-side because that page is all it
 * ever shows.
 */
export function NotificationsPage() {
  const navigate = useNavigate();
  const list = useListQuery({ filterKeys: FILTER_KEYS, defaultPageSize: 25 });
  const inbox = useNotifications(list.query);
  const counts = useUnreadCounts();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = counts.data?.notifications ?? 0;
  const items = inbox.data?.items ?? [];

  const openNotification = (notification: AppNotification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Notifications"
        description="Everything the school has told you, newest first."
        breadcrumbs={[{ label: 'Notifications' }]}
        actions={
          <>
            {unread > 0 && (
              <Button
                data-cy="notifications-page-mark-all-read"
                variant="outline"
                onClick={() => markAllRead.mutate()}
                loading={markAllRead.isPending}
              >
                <CheckCheck />
                Mark all read
              </Button>
            )}
            <Button data-cy="notifications-page-settings" variant="ghost" asChild>
              <Link to="/profile/notifications">
                <Settings />
                Settings
              </Link>
            </Button>
          </>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search notifications…"
        isSearching={list.isSearchPending || inbox.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All' }]}
      />

      <Card className="overflow-hidden">
        {inbox.isPending ? (
          <div className="space-y-4 p-4" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
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
        ) : inbox.isError && !inbox.data ? (
          // A failed load is not an empty inbox, and must not read as one.
          <ErrorState
            data-cy="notifications-page-error"
            title="Couldn’t load notifications"
            error={inbox.error}
            onRetry={() => void inbox.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell />}
            title={list.isFiltered ? 'No notifications match those filters' : 'No notifications yet'}
            description={
              list.isFiltered
                ? 'Try clearing the search or the status filter.'
                : 'Alerts about attendance, results, fees and more will appear here.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border" data-cy="notifications-page-list">
              {items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={openNotification}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              ))}
            </ul>
            {inbox.data && (
              <Pagination
                meta={inbox.data.meta}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                isFetching={inbox.isFetching}
              />
            )}
          </>
        )}
      </Card>
    </PageContainer>
  );
}
