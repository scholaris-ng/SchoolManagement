import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Plus } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useAssessments } from './api';
import type { CbtAssessment } from '@/types/assessment';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Badge, Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';

const MODE_OPTIONS = [
  { value: 'PRACTICE', label: 'Practice' },
  { value: 'EXAM', label: 'Examination' },
];

const STATE_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'GRADED', label: 'Graded' },
];

/**
 * Computer-based tests.
 *
 * Students see only what is open to them — the server filters by class and
 * state — so this same page serves a teacher managing papers and a child
 * looking for tonight's practice.
 */
export function AssessmentsPage() {
  const navigate = useNavigate();
  const { persona, can } = useAuth();
  const list = useListQuery({ filterKeys: ['mode', 'state'] });
  const assessments = useAssessments(list.query);

  const isStudent = persona === 'student';

  const columns = useMemo<Column<CbtAssessment>[]>(
    () => [
      {
        id: 'title',
        header: 'Assessment',
        cell: (assessment) => (
          <div className="min-w-0">
            <Link
              to={`/cbt/${assessment.id}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {assessment.title}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {assessment.subjectName} · {assessment.classNames.join(', ') || 'All classes'}
            </p>
          </div>
        ),
      },
      {
        id: 'mode',
        header: 'Mode',
        cell: (assessment) => (
          <Badge tone={assessment.mode === 'EXAM' ? 'danger' : 'info'}>
            {humanizeEnum(assessment.mode)}
          </Badge>
        ),
      },
      {
        id: 'shape',
        header: 'Paper',
        hideOnMobile: true,
        cell: (assessment) => (
          <div className="text-xs">
            <p>
              {assessment.questionCount} questions · {assessment.totalMarks} marks
            </p>
            <p className="text-muted-foreground">
              {assessment.durationMinutes} minutes · pass {assessment.passScore}%
            </p>
          </div>
        ),
      },
      {
        id: 'window',
        header: 'Opens',
        hideOnMobile: true,
        cell: (assessment) =>
          assessment.startsAt ? (
            <div className="text-xs">
              <p>{formatDateTime(assessment.startsAt)}</p>
              {assessment.endsAt && (
                <p className="text-muted-foreground">until {formatDateTime(assessment.endsAt)}</p>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Any time</span>
          ),
      },
      {
        id: 'submissions',
        header: 'Attempts',
        align: 'center',
        hideOnMobile: true,
        cell: (assessment) => <span className="tabular-nums">{assessment.submissionCount}</span>,
      },
      {
        id: 'state',
        header: 'Status',
        cell: (assessment) => <StatusBadge status={assessment.state} />,
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        cell: (assessment) =>
          assessment.state === 'OPEN' && can('cbt.take') ? (
            <Button size="sm" asChild>
              <Link to={`/cbt/${assessment.id}`} onClick={(event) => event.stopPropagation()}>
                Start
              </Link>
            </Button>
          ) : null,
      },
    ],
    [can],
  );

  return (
    <PageContainer>
      <PageHeader
        title={isStudent ? 'Tests and practice' : 'Computer-based tests'}
        description={
          isStudent
            ? 'Papers open to you right now. Practice papers show you the answers afterwards.'
            : 'Practice papers and examinations, built from the question bank.'
        }
        breadcrumbs={[{ label: 'Assessment' }, { label: 'CBT' }]}
        actions={
          <PermissionGate require="cbt.manage">
            <Button asChild>
              <Link to="/cbt/new">
                <Plus />
                New assessment
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      {isStudent && (
        <Card className="border-info/30 bg-info-subtle">
          <CardContent className="flex items-start gap-3 pt-5 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            <p>
              Your answers are saved on this device as you go. If your connection drops mid-paper,
              keep answering — everything syncs when it comes back.
            </p>
          </CardContent>
        </Card>
      )}

      {!isStudent && (
        <FilterBar
          search={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder="Search by title…"
          values={list.filters}
          onFilterChange={list.setFilter}
          onReset={list.isFiltered ? list.reset : undefined}
          filters={[
            { key: 'mode', label: 'Mode', options: MODE_OPTIONS, allLabel: 'All modes' },
            { key: 'state', label: 'Status', options: STATE_OPTIONS, allLabel: 'All statuses' },
          ]}
        />
      )}

      <DataTable
        caption="Assessments with mode, paper shape, availability window and status"
        data={assessments.data?.items}
        meta={assessments.data?.meta}
        columns={columns}
        rowKey={(assessment) => assessment.id}
        isLoading={assessments.isPending}
        isFetching={assessments.isFetching}
        error={assessments.error}
        onRetry={() => void assessments.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={(assessment) => navigate(`/cbt/${assessment.id}`)}
        emptyIcon={<BookOpen />}
        emptyTitle={isStudent ? 'Nothing open for you right now' : 'No assessments yet'}
        emptyDescription={
          isStudent
            ? 'Your teachers will open practice papers and tests here.'
            : 'Build a paper from the question bank, then open it to a class.'
        }
      />

      {isStudent && (assessments.data?.items.length ?? 0) === 0 && (
        <EmptyState
          compact
          icon={<BookOpen />}
          title="Check back later"
          description="Practice papers appear as soon as a teacher opens one for your class."
        />
      )}
    </PageContainer>
  );
}
