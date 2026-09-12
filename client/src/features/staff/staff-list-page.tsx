import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, UploadCloud, UserCog, UserX } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses, useSubjects } from '@/features/academics/api';
import { useBulkExitStaff, useStaffList } from './api';
import type { StaffMember } from '@/types/people';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar, SelectionBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
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
  const { can } = useAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const list = useListQuery({
    filterKeys: ['status', 'employmentType', 'department', 'classId', 'subjectId'],
    defaultSortBy: 'lastName',
    // The staff query is slower than most list screens, so it gets the
    // longer of the two debounce delays client_arch.md calls for (§12) —
    // waiting the extra time is cheaper than firing a search per keystroke.
    searchDebounceMs: 2000,
  });
  const staff = useStaffList(list.query);
  const bulkExit = useBulkExitStaff();
  const classes = useClasses();
  const subjects = useSubjects();

  const selectedMembers = useMemo(
    () => (staff.data?.items ?? []).filter((member) => selectedIds.includes(member.id)),
    [staff.data, selectedIds],
  );

  const confirmExit = async () => {
    await bulkExit.mutateAsync(selectedMembers.map(({ id, version }) => ({ id, version })));
    setExitConfirmOpen(false);
    setSelectedIds([]);
  };

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (member: StaffMember) => navigate(`/staff/${member.id}`),
    [navigate],
  );

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
        isSearching={list.isSearchPending || staff.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
          { key: 'employmentType', label: 'Employment', options: EMPLOYMENT_OPTIONS },
          {
            key: 'classId',
            label: 'Class',
            options: (classes.data ?? []).map((schoolClass) => ({
              value: schoolClass.id,
              label: schoolClass.name,
            })),
            allLabel: 'All classes',
          },
          {
            key: 'subjectId',
            label: 'Subject',
            options: (subjects.data ?? []).map((subject) => ({
              value: subject.id,
              label: subject.name,
            })),
            allLabel: 'All subjects',
          },
        ]}
      />

      <SelectionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button
          data-cy="staff-list-mark-exited"
          variant="outline"
          size="sm"
          onClick={() => setExitConfirmOpen(true)}
        >
          <UserX />
          Mark as exited
        </Button>
      </SelectionBar>

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
        selectedIds={can('staff.manage') ? selectedIds : undefined}
        onSelectionChange={can('staff.manage') ? setSelectedIds : undefined}
        onRowClick={handleRowClick}
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

      <ConfirmDialog
        data-cy="staff-list-exit-confirm"
        open={exitConfirmOpen}
        onOpenChange={setExitConfirmOpen}
        tone="danger"
        title={`Mark ${selectedMembers.length === 1 ? 'this staff member' : `${selectedMembers.length} staff members`} as exited?`}
        description="They will no longer be able to sign in. Their record, past teaching assignments and history are kept, and this can be reversed by editing their status back to Active."
        confirmLabel="Mark as exited"
        loading={bulkExit.isPending}
        onConfirm={confirmExit}
      />
    </PageContainer>
  );
}
