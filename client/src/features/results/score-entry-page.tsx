import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table2 } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useClasses, useSubjects, useTerms } from '@/features/academics/api';
import { useScoreSheets, type ScoreSheetSummary } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Progress } from '@/components/ui/primitives';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PUBLISHED', label: 'Published' },
];

/**
 * The list of worksheets a teacher owes.
 *
 * One row per class + subject + term, showing how much of each is entered, so
 * "what have I still got to do?" is answered without opening anything.
 */
export function ScoreEntryPage() {
  const navigate = useNavigate();
  const list = useListQuery({ filterKeys: ['classId', 'subjectId', 'termId', 'status'] });
  const sheets = useScoreSheets(list.query);
  const classes = useClasses();
  // Once a class is chosen, only the subjects taught in it stay on offer.
  const subjects = useSubjects(
    list.filters.classId ? { classId: list.filters.classId } : {},
  );
  const terms = useTerms();

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (sheet: ScoreSheetSummary) => navigate(`/results/entry/${sheet.id}`),
    [navigate],
  );

  const columns = useMemo<Column<ScoreSheetSummary>[]>(
    () => [
      {
        id: 'sheet',
        header: 'Class and subject',
        cell: (sheet) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {sheet.subjectName}
              <span className="font-normal text-muted-foreground"> · {sheet.className}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {sheet.termName} · {sheet.sessionName}
            </p>
          </div>
        ),
      },
      {
        id: 'progress',
        header: 'Entered',
        cell: (sheet) => (
          <div className="w-40">
            <div className="flex items-baseline justify-between text-xs">
              <span className="tabular-nums text-muted-foreground">
                {sheet.enteredCount} / {sheet.totalCount}
              </span>
            </div>
            <Progress
              className="mt-1"
              value={sheet.totalCount === 0 ? 0 : (sheet.enteredCount / sheet.totalCount) * 100}
              tone={sheet.enteredCount === sheet.totalCount ? 'success' : 'warning'}
            />
          </div>
        ),
      },
      {
        id: 'average',
        header: 'Class average',
        align: 'right',
        hideOnMobile: true,
        cell: (sheet) =>
          sheet.classAverage === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">{sheet.classAverage.toFixed(1)}</span>
          ),
      },
      {
        id: 'submitted',
        header: 'Submitted',
        hideOnMobile: true,
        cell: (sheet) =>
          sheet.submittedAt ? (
            <div className="text-xs">
              <p>{sheet.submittedByName}</p>
              <p className="text-muted-foreground">{formatDateTime(sheet.submittedAt)}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (sheet) => <StatusBadge status={sheet.status} />,
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Score entry"
        description="Every worksheet you are responsible for, and how far through each one you are."
        breadcrumbs={[{ label: 'Assessment' }, { label: 'Score entry' }]}
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by class or subject…"
        isSearching={list.isSearchPending || sheets.isFetching}
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
          {
            key: 'termId',
            label: 'Term',
            options: (terms.data ?? []).map((t) => ({
              value: t.id,
              label: `${t.name} · ${t.sessionName}`,
            })),
          },
        ]}
      />

      <DataTable

        data-cy="results-score-entry-table"
        caption="Score sheets by class and subject, with entry progress and workflow status"
        data={sheets.data?.items}
        meta={sheets.data?.meta}
        columns={columns}
        rowKey={(sheet) => sheet.id}
        isLoading={sheets.isPending}
        isFetching={sheets.isFetching}
        error={sheets.error}
        onRetry={() => void sheets.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={handleRowClick}
        emptyIcon={<Table2 />}
        emptyTitle={list.isFiltered ? 'No score sheets match those filters' : 'No score sheets yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'Score sheets are created once classes, subjects and a grading scheme are configured.'
        }
      />
    </PageContainer>
  );
}
