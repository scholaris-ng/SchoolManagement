import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, UploadCloud, UserCog } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useStaffList } from './api';
import type { StaffMember } from '@/types/people';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'EXITED', label: 'Exited' },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
];

export function StaffListPage() {
  const navigate = useNavigate();
  const list = useListQuery({
    filterKeys: ['status', 'employmentType', 'department'],
    defaultSortBy: 'lastName',
  });
  const staff = useStaffList(list.query);

  const columns = useMemo<Column<StaffMember>[]>(
    () => [
      {
        id: 'member',
        header: 'Staff member',
        sortKey: 'lastName',
        cell: (member) => (
          <div className="flex items-center gap-3">
            <Avatar name={member.fullName} src={member.photoUrl} size="sm" />
            <div className="min-w-0">
              <Link
                to={`/staff/${member.id}`}
                className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {member.fullName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {member.staffNo} · {member.designation}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'roles',
        header: 'Roles',
        cell: (member) => (
          <div className="flex flex-wrap gap-1">
            {member.roleNames.slice(0, 2).map((role) => (
              <Badge key={role} tone="neutral">
                {humanizeEnum(role)}
              </Badge>
            ))}
            {member.roleNames.length > 2 && (
              <Badge tone="outline">+{member.roleNames.length - 2}</Badge>
            )}
          </div>
        ),
      },
      {
        id: 'teaching',
        header: 'Teaching',
        hideOnMobile: true,
        cell: (member) => (
          <div className="min-w-0 text-sm">
            <p className="truncate">
              {member.subjectNames.length > 0 ? member.subjectNames.join(', ') : '—'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {member.classNames.length > 0 ? member.classNames.join(', ') : 'No classes assigned'}
            </p>
          </div>
        ),
      },
      {
        id: 'employment',
        header: 'Employment',
        hideOnMobile: true,
        cell: (member) => (
          <div className="text-sm">
            <p>{humanizeEnum(member.employmentType)}</p>
            <p className="text-xs text-muted-foreground">
              Since {formatDate(member.employmentDate, 'MMM yyyy')}
            </p>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (member) => <StatusBadge status={member.status} />,
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Staff"
        description="Teaching and non-teaching staff, their roles, and what they are responsible for."
        breadcrumbs={[{ label: 'People' }, { label: 'Staff' }]}
        actions={
          <>
            <PermissionGate require="import.run">
              <Button data-cy="staff-list-import" variant="outline" asChild>
                <Link to="/import?entity=STAFF">
                  <UploadCloud />
                  Import
                </Link>
              </Button>
            </PermissionGate>
            <PermissionGate require="staff.manage">
              <Button data-cy="staff-list-add-staff" asChild>
                <Link to="/staff/new">
                  <Plus />
                  Add staff
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by name, staff number or email…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
          { key: 'employmentType', label: 'Employment', options: EMPLOYMENT_OPTIONS },
        ]}
      />

      <DataTable

        data-cy="staff-table"
        caption="Staff with roles, teaching assignments and employment status"
        data={staff.data?.items}
        meta={staff.data?.meta}
        columns={columns}
        rowKey={(member) => member.id}
        isLoading={staff.isPending}
        isFetching={staff.isFetching}
        error={staff.error}
        onRetry={() => void staff.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onRowClick={(member) => navigate(`/staff/${member.id}`)}
        emptyIcon={<UserCog />}
        emptyTitle={list.isFiltered ? 'No staff match those filters' : 'No staff recorded yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'Add your teachers and administrators so they can sign in and take registers.'
        }
        emptyAction={
          <PermissionGate require="staff.manage">
            <Button data-cy="staff-list-add-the-first-staff" asChild>
              <Link to="/staff/new">
                <Plus />
                Add the first staff member
              </Link>
            </Button>
          </PermissionGate>
        }
      />
    </PageContainer>
  );
}
