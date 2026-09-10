import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Download, Plus, UploadCloud, Users } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses, useLevels } from '@/features/academics/api';
import { useStudents } from './api';
import { PromoteStudentsDialog } from './promote-students-dialog';
import type { Student } from '@/types/people';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar, SelectionBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Avatar } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';
import { exportRowsToXlsx } from '@/lib/xlsx';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

export function StudentsListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const list = useListQuery({
    filterKeys: ['status', 'classId', 'levelId', 'gender', 'houseId'],
    defaultSortBy: 'lastName',
  });

  // The list defaults to enrolled students; leavers are one filter click away
  // rather than cluttering the register every school looks at daily.
  const query = useMemo(
    () => ({ ...list.query, status: list.filters.status ?? 'ACTIVE' }),
    [list.query, list.filters.status],
  );

  const students = useStudents(query);
  const classes = useClasses();
  const levels = useLevels();

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (student: Student) => navigate(`/students/${student.id}`),
    [navigate],
  );

  const columns = useMemo<Column<Student>[]>(
    () => [
      {
        id: 'student',
        header: 'Student',
        sortKey: 'lastName',
        sticky: true,
        cell: (student) => (
          <div className="flex items-center gap-3">
            <Avatar
              name={student.fullName}
              src={student.photoUrl}
              suppressPhoto={!student.photoConsent}
              size="sm"
            />
            <div className="min-w-0">
              <Link
                to={`/students/${student.id}`}
                className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {student.fullName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{student.admissionNo}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'class',
        header: 'Class',
        sortKey: 'className',
        cell: (student) => (
          <div className="min-w-0">
            <p className="truncate">{student.currentClassName ?? '—'}</p>
            <p className="truncate text-xs text-muted-foreground">{student.currentLevelName}</p>
          </div>
        ),
      },
      {
        id: 'gender',
        header: 'Gender',
        hideOnMobile: true,
        cell: (student) => (student.gender === 'MALE' ? 'Male' : 'Female'),
      },
      {
        id: 'dob',
        header: 'Date of birth',
        sortKey: 'dateOfBirth',
        hideOnMobile: true,
        cell: (student) => formatDate(student.dateOfBirth),
      },
      {
        id: 'house',
        header: 'House',
        hideOnMobile: true,
        cell: (student) => student.houseName ?? '—',
      },
      {
        id: 'guardians',
        header: 'Guardians',
        align: 'center',
        hideOnMobile: true,
        cell: (student) => (
          <span className="tabular-nums">{student.guardianCount}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (student) => <StatusBadge status={student.status} />,
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        hideOnMobile: true,
        cell: (student) => (
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            data-cy={`students-list-open-${student.id}`}
          >
            <Link to={`/students/${student.id}`} aria-label={`Open ${student.fullName}`}>
              <ArrowUpRight />
            </Link>
          </Button>
        ),
      },
    ],
    [],
  );

  const exportSelection = () => {
    const rows = (students.data?.items ?? []).filter((student) =>
      selectedIds.includes(student.id),
    );
    void exportRowsToXlsx(
      `students-${new Date().toISOString().slice(0, 10)}.xlsx`,
      rows.map((student) => ({
        'Admission no': student.admissionNo,
        Surname: student.lastName,
        'First name': student.firstName,
        'Middle name': student.middleName ?? '',
        Gender: student.gender,
        'Date of birth': student.dateOfBirth,
        Class: student.currentClassName ?? '',
        House: student.houseName ?? '',
        Status: student.status,
      })),
      { sheetName: 'Students' },
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Students"
        description="Every child enrolled at the school, with their class, house and guardians."
        breadcrumbs={[{ label: 'People' }, { label: 'Students' }]}
        actions={
          <>
            <PermissionGate require="import.run">
              <Button data-cy="students-list-import" variant="outline" asChild>
                <Link to="/import?entity=STUDENTS">
                  <UploadCloud />
                  Import
                </Link>
              </Button>
            </PermissionGate>
            <PermissionGate require="student.promote">
              <Button data-cy="students-list-promote-class" variant="outline" onClick={() => setPromoteOpen(true)}>
                Promote class
              </Button>
            </PermissionGate>
            <PermissionGate require="student.create">
              <Button data-cy="students-list-add-student" asChild>
                <Link to="/students/new">
                  <Plus />
                  Add student
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by name or admission number…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
          {
            key: 'levelId',
            label: 'Level',
            options: (levels.data ?? []).map((level) => ({
              value: level.id,
              label: level.name,
            })),
          },
          {
            key: 'classId',
            label: 'Class',
            options: (classes.data ?? [])
              .filter(
                (schoolClass) =>
                  !list.filters.levelId || schoolClass.levelId === list.filters.levelId,
              )
              .map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name })),
          },
          {
            key: 'gender',
            label: 'Gender',
            options: [
              { value: 'MALE', label: 'Male' },
              { value: 'FEMALE', label: 'Female' },
            ],
          },
        ]}
      />

      <SelectionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button data-cy="students-list-export-excel" variant="outline" size="sm" onClick={exportSelection}>
          <Download />
          Export Excel
        </Button>
      </SelectionBar>

      <DataTable

        data-cy="students-table"
        caption="List of students with class, house, guardian count and enrolment status"
        data={students.data?.items}
        meta={students.data?.meta}
        columns={columns}
        rowKey={(student) => student.id}
        isLoading={students.isPending}
        isFetching={students.isFetching}
        error={students.error}
        onRetry={() => void students.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        selectedIds={can('student.update') ? selectedIds : undefined}
        onSelectionChange={can('student.update') ? setSelectedIds : undefined}
        onRowClick={handleRowClick}
        emptyIcon={<Users />}
        emptyTitle={list.isFiltered ? 'No students match those filters' : 'No students yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try widening the filters, or clear them to see the whole register.'
            : 'Add students one at a time, or import your existing register from a spreadsheet.'
        }
        emptyAction={
          list.isFiltered ? (
            <Button data-cy="students-list-clear-filters" variant="outline" onClick={list.reset}>
              Clear filters
            </Button>
          ) : (
            <PermissionGate require="student.create">
              <Button data-cy="students-list-add-the-first-student" asChild>
                <Link to="/students/new">
                  <Plus />
                  Add the first student
                </Link>
              </Button>
            </PermissionGate>
          )
        }
      />

      <PromoteStudentsDialog open={promoteOpen} onOpenChange={setPromoteOpen} />
    </PageContainer>
  );
}
