import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Mail, Phone, Plus, Send, UploadCloud } from 'lucide-react';
import { formatRelative } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useGuardians, useInviteGuardian } from './api';
import type { Guardian } from '@/types/people';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';

const PORTAL_OPTIONS = [
  { value: 'true', label: 'Has portal access' },
  { value: 'false', label: 'No portal access' },
];

export function GuardiansListPage() {
  const navigate = useNavigate();
  const list = useListQuery({ filterKeys: ['hasPortalAccess'], defaultSortBy: 'lastName' });
  const guardians = useGuardians(list.query);
  const invite = useInviteGuardian();

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (guardian: Guardian) => navigate(`/guardians/${guardian.id}`),
    [navigate],
  );

  const columns = useMemo<Column<Guardian>[]>(
    () => [
      {
        id: 'guardian',
        header: 'Guardian',
        sortKey: 'lastName',
        cell: (guardian) => (
          <div className="flex items-center gap-3">
            <Avatar name={guardian.fullName} src={guardian.photoUrl} size="sm" />
            <div className="min-w-0">
              <Link
                to={`/guardians/${guardian.id}`}
                className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {guardian.title ? `${guardian.title} ` : ''}
                {guardian.fullName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {guardian.occupation ?? 'Guardian'}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: (guardian) => (
          <div className="min-w-0 space-y-0.5 text-sm">
            <p className="flex items-center gap-1.5 truncate">
              <Phone className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              {guardian.phone}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Mail className="size-3 shrink-0" aria-hidden="true" />
              {guardian.email}
            </p>
          </div>
        ),
      },
      {
        id: 'children',
        header: 'Children',
        align: 'center',
        cell: (guardian) => <span className="tabular-nums">{guardian.studentCount}</span>,
      },
      {
        id: 'portal',
        header: 'Parent portal',
        hideOnMobile: true,
        cell: (guardian) =>
          guardian.hasPortalAccess ? (
            <div>
              <Badge tone="success">Active</Badge>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {guardian.lastLoginAt ? `Last seen ${formatRelative(guardian.lastLoginAt)}` : 'Never signed in'}
              </p>
            </div>
          ) : (
            <Badge tone="neutral">Not invited</Badge>
          ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        hideOnMobile: true,
        cell: (guardian) => (
          <PermissionGate require="guardian.manage">
            <Button
              variant="ghost"
              size="sm"
              data-cy={`guardians-list-invite-${guardian.id}`}
              loading={invite.isPending && invite.variables === guardian.id}
              onClick={(event) => {
                event.stopPropagation();
                invite.mutate(guardian.id);
              }}
            >
              <Send />
              {guardian.hasPortalAccess ? 'Resend invite' : 'Invite'}
            </Button>
          </PermissionGate>
        ),
      },
    ],
    [invite],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Guardians"
        description="Parents and guardians, and the children each of them is responsible for."
        breadcrumbs={[{ label: 'People' }, { label: 'Guardians' }]}
        actions={
          <>
            <PermissionGate require="import.run">
              <Button data-cy="guardians-list-import" variant="outline" asChild>
                <Link to="/import?entity=GUARDIANS">
                  <UploadCloud />
                  Import
                </Link>
              </Button>
            </PermissionGate>
            <PermissionGate require="guardian.manage">
              <Button data-cy="guardians-list-add-guardian" asChild>
                <Link to="/guardians/new">
                  <Plus />
                  Add guardian
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by name, phone or email…"
        isSearching={list.isSearchPending || guardians.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          {
            key: 'hasPortalAccess',
            label: 'Portal',
            options: PORTAL_OPTIONS,
            allLabel: 'All guardians',
          },
        ]}
      />

      <DataTable

        data-cy="guardians-table"
        caption="Guardians with contact details, linked children and parent-portal status"
        data={guardians.data?.items}
        meta={guardians.data?.meta}
        columns={columns}
        rowKey={(guardian) => guardian.id}
        isLoading={guardians.isPending}
        isFetching={guardians.isFetching}
        error={guardians.error}
        onRetry={() => void guardians.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onRowClick={handleRowClick}
        emptyIcon={<Heart />}
        emptyTitle={list.isFiltered ? 'No guardians match those filters' : 'No guardians yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters to see everyone.'
            : 'Add guardians as you register students, or import them from a spreadsheet.'
        }
        emptyAction={
          <PermissionGate require="guardian.manage">
            <Button data-cy="guardians-list-add-a-guardian" asChild>
              <Link to="/guardians/new">
                <Plus />
                Add a guardian
              </Link>
            </Button>
          </PermissionGate>
        }
      />
    </PageContainer>
  );
}
