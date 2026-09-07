import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotebookPen, Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useClasses, useSubjects } from '@/features/academics/api';
import { useLessonNotes } from './api';
import type { LessonNote } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'RETURNED', label: 'Returned' },
];

export function LessonNotesPage() {
  const navigate = useNavigate();
  const list = useListQuery({
    filterKeys: ['classId', 'subjectId', 'status'],
    defaultSortBy: 'date',
    defaultSortDir: 'desc',
  });
  const notes = useLessonNotes(list.query);
  const classes = useClasses();
  const subjects = useSubjects();

  const columns = useMemo<Column<LessonNote>[]>(
    () => [
      {
        id: 'note',
        header: 'Lesson',
        cell: (note) => (
          <div className="min-w-0">
            <Link
              to={`/lesson-notes/${note.id}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {note.topic}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {note.subjectName} · {note.className} · week {note.weekNumber}
            </p>
          </div>
        ),
      },
      {
        id: 'teacher',
        header: 'Teacher',
        hideOnMobile: true,
        cell: (note) => note.teacherName,
      },
      {
        id: 'date',
        header: 'Date',
        sortKey: 'date',
        cell: (note) => formatDate(note.date),
      },
      {
        id: 'review',
        header: 'Reviewed by',
        hideOnMobile: true,
        cell: (note) =>
          note.reviewerName ? (
            <div className="text-xs">
              <p>{note.reviewerName}</p>
              {note.reviewedAt && (
                <p className="text-muted-foreground">{formatDate(note.reviewedAt)}</p>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (note) => <StatusBadge status={note.status} />,
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Lesson notes"
        description="What was actually taught, what worked, and where students struggled."
        breadcrumbs={[{ label: 'Teaching' }, { label: 'Lesson notes' }]}
        actions={
          <PermissionGate require="lessonnote.manage">
            <Button asChild>
              <Link to="/lesson-notes/new">
                <Plus />
                Write a note
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by topic or teacher…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
          {
            key: 'classId',
            label: 'Class',
            options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })),
          },
          {
            key: 'subjectId',
            label: 'Subject',
            options: (subjects.data ?? []).map((s) => ({ value: s.id, label: s.name })),
          },
        ]}
      />

      <DataTable
        caption="Lesson notes with class, subject, teacher and review status"
        data={notes.data?.items}
        meta={notes.data?.meta}
        columns={columns}
        rowKey={(note) => note.id}
        isLoading={notes.isPending}
        isFetching={notes.isFetching}
        error={notes.error}
        onRetry={() => void notes.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onRowClick={(note) => navigate(`/lesson-notes/${note.id}`)}
        emptyIcon={<NotebookPen />}
        emptyTitle={list.isFiltered ? 'No lesson notes match those filters' : 'No lesson notes yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'Notes record what was taught and what students found hard — the detail a head of department cannot get from a timetable.'
        }
      />
    </PageContainer>
  );
}
