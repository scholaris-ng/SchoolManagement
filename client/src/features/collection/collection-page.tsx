import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bus, UserCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useCollectionEvents } from './api';
import type { CollectionEvent } from '@/types/people';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import { ReleaseDialog } from './collection-page-parts';

/**
 * Child collection.
 *
 * The safeguarding question this answers is simple and serious: did the right
 * adult take this child? So the release flow starts from the authorised list,
 * requires an explicit override for anyone not on it, and writes an immutable
 * record either way (spec section 12).
 */
export function CollectionPage() {
  const navigate = useNavigate();
  const list = useListQuery({ defaultPageSize: 25 });
  const events = useCollectionEvents(list.query);
  const [releaseOpen, setReleaseOpen] = useState(false);

  const columns = useMemo<Column<CollectionEvent>[]>(
    () => [
      {
        id: 'student',
        header: 'Child',
        cell: (event) => (
          <div className="min-w-0">
            <Link
              to={`/students/${event.studentId}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              {event.studentName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {event.studentAdmissionNo}
              {event.className ? ` · ${event.className}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'collector',
        header: 'Collected by',
        cell: (event) => (
          <div className="min-w-0">
            <p className="truncate">{event.pickupPersonName}</p>
            <p className="truncate text-xs text-muted-foreground">{event.relationship}</p>
          </div>
        ),
      },
      {
        id: 'method',
        header: 'How',
        hideOnMobile: true,
        cell: (event) => <Badge tone="neutral">{humanizeEnum(event.method)}</Badge>,
      },
      {
        id: 'released',
        header: 'Released',
        cell: (event) => (
          <div className="min-w-0 text-sm">
            <p>{formatDateTime(event.releasedAt)}</p>
            <p className="truncate text-xs text-muted-foreground">by {event.releasedByName}</p>
          </div>
        ),
      },
      {
        id: 'notified',
        header: 'Guardian told',
        align: 'center',
        hideOnMobile: true,
        cell: (event) =>
          event.parentNotified ? (
            <Badge tone="success">Notified</Badge>
          ) : (
            <Badge tone="neutral">No</Badge>
          ),
      },
      {
        id: 'note',
        header: 'Note',
        hideOnMobile: true,
        cell: (event) =>
          event.note ? (
            <span className="line-clamp-2 max-w-xs text-xs">{event.note}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Child collection"
        description="Who collected which child, when, and which member of staff released them."
        breadcrumbs={[{ label: 'Behaviour & safety' }, { label: 'Child collection' }]}
        actions={
          <PermissionGate require="collection.manage">
            <Button data-cy="collection-release-a-child" onClick={() => setReleaseOpen(true)}>
              <UserCheck />
              Release a child
            </Button>
          </PermissionGate>
        }
      />

      <Alert tone="info" title="This log cannot be edited">
        Collection records are written once and kept. If something was recorded in error, add a new
        entry explaining it rather than trying to change history.
      </Alert>

      <DataTable

        data-cy="collection-table"
        caption="Collection log: child, collector, time and releasing staff member"
        data={events.data?.items}
        meta={events.data?.meta}
        columns={columns}
        rowKey={(event) => event.id}
        isLoading={events.isPending}
        isFetching={events.isFetching}
        error={events.error}
        onRetry={() => void events.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={(event) => navigate(`/students/${event.studentId}`)}
        emptyIcon={<Bus />}
        emptyTitle="No collections recorded yet"
        emptyDescription="Records appear here as children are released at the gate."
      />

      <ReleaseDialog open={releaseOpen} onOpenChange={setReleaseOpen} />
    </PageContainer>
  );
}
