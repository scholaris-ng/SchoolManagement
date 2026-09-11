import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useStudents } from '@/features/students/api';
import type { Student } from '@/types/people';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Avatar } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Enrolled' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'ALUMNI', label: 'Alumni' },
  { value: 'TRANSFERRED', label: 'Transferred' },
];

/**
 * Transcripts are issued per student, so this is a student picker first.
 *
 * Leavers matter most here — a transcript is usually requested by someone who
 * has already left — so the default filter is deliberately wide.
 */
export function TranscriptsPage() {
  const navigate = useNavigate();
  const list = useListQuery({ filterKeys: ['status', 'classId'], defaultSortBy: 'lastName' });
  const students = useStudents(list.query);

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (student: Student) => navigate(`/transcripts/${student.id}`),
    [navigate],
  );

  const columns = useMemo<Column<Student>[]>(
    () => [
      {
        id: 'student',
        header: 'Student',
        sortKey: 'lastName',
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
                to={`/transcripts/${student.id}`}
                className="block truncate font-medium hover:text-primary hover:underline"
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
        header: 'Last class',
        cell: (student) => student.currentClassName ?? '—',
      },
      {
        id: 'admitted',
        header: 'Admitted',
        hideOnMobile: true,
        cell: (student) => formatDate(student.admissionDate),
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
          <Button data-cy="results-transcripts-view-transcript" variant="ghost" size="sm" asChild>
            <Link to={`/transcripts/${student.id}`}>View transcript</Link>
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Transcripts"
        description="Multi-year academic records, built from historical enrolments and published results."
        breadcrumbs={[{ label: 'Assessment' }, { label: 'Transcripts' }]}
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by name or admission number…"
        isSearching={list.isSearchPending || students.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All students' },
        ]}
      />

      <DataTable

        data-cy="results-transcripts-table"
        caption="Students a transcript can be issued for"
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
        onRowClick={handleRowClick}
        emptyIcon={<GraduationCap />}
        emptyTitle="No students found"
        emptyDescription="Transcripts are built from published results across sessions."
      />
    </PageContainer>
  );
}
