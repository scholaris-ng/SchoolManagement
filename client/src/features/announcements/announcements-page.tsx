import { Link } from 'react-router-dom';
import { Megaphone, Pin, Plus } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAnnouncements } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import {
  Badge,
  Card,
  CardContent,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/data/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';

const AUDIENCE_OPTIONS = [
  { value: 'EVERYONE', label: 'Everyone' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'PARENTS', label: 'Parents' },
  { value: 'STUDENTS', label: 'Students' },
  { value: 'CLASSES', label: 'Specific classes' },
];

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PUBLISHED', label: 'Published' },
];

export function AnnouncementsPage() {
  const list = useListQuery({ filterKeys: ['audience', 'status'], defaultPageSize: 20 });
  const announcements = useAnnouncements(list.query);

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        description="Notices sent to the whole school or a particular group, with delivery and read counts."
        breadcrumbs={[{ label: 'Communication' }, { label: 'Announcements' }]}
        actions={
          <PermissionGate require="announcement.manage">
            <Button data-cy="announcements-new-announcement" asChild>
              <Link to="/announcements/new">
                <Plus />
                New announcement
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search announcements…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'audience', label: 'Audience', options: AUDIENCE_OPTIONS, allLabel: 'All audiences' },
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
        ]}
      />

      {announcements.isPending ? (
        <LoadingState label="Loading announcements…" />
      ) : announcements.isError ? (
        <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} />
      ) : (announcements.data?.items.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone />}
            title={list.isFiltered ? 'No announcements match those filters' : 'No announcements yet'}
            description={
              list.isFiltered
                ? 'Try clearing the filters.'
                : 'Post a notice to parents, staff or a particular class.'
            }
            action={
              <PermissionGate require="announcement.manage">
                <Button data-cy="announcements-write-the-first-one" asChild>
                  <Link to="/announcements/new">
                    <Plus />
                    Write the first one
                  </Link>
                </Button>
              </PermissionGate>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {announcements.data?.items.map((announcement) => {
              const readRate =
                announcement.recipientCount === 0
                  ? 0
                  : (announcement.readCount / announcement.recipientCount) * 100;
              return (
                <Card key={announcement.id}>
                  <CardContent className="space-y-2 pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {announcement.pinned && (
                            <Pin className="size-3.5 text-primary" aria-label="Pinned" />
                          )}
                          <p className="font-semibold">{announcement.title}</p>
                          <StatusBadge status={announcement.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {announcement.authorName} · {formatDateTime(announcement.publishAt)}
                        </p>
                      </div>
                      <PermissionGate require="announcement.manage">
                        <Button data-cy="announcements-edit" variant="ghost" size="sm" asChild>
                          <Link to={`/announcements/${announcement.id}/edit`}>Edit</Link>
                        </Button>
                      </PermissionGate>
                    </div>

                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {announcement.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="primary">{humanizeEnum(announcement.audience)}</Badge>
                      {announcement.channels.map((channel) => (
                        <Badge key={channel} tone="outline">
                          {humanizeEnum(channel)}
                        </Badge>
                      ))}
                    </div>

                    {announcement.status === 'PUBLISHED' && announcement.recipientCount > 0 && (
                      <div className="max-w-xs">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-muted-foreground">Read</span>
                          <span className="tabular-nums">
                            {announcement.readCount} of {announcement.recipientCount}
                          </span>
                        </div>
                        <Progress className="mt-1" value={readRate} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {announcements.data?.meta && (
            <Card>
              <Pagination
                meta={announcements.data.meta}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                isFetching={announcements.isFetching}
              />
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
}
