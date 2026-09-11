import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Sparkles } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses, useSubjects } from '@/features/academics/api';
import { useGenerateScheme, useSchemes, type SchemeSummary } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { GenerateSchemeDialog } from './schemes-page-parts';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
];

export function SchemesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListQuery({ filterKeys: ['classId', 'subjectId', 'status'] });
  const schemes = useSchemes(list.query);
  const classes = useClasses();
  const subjects = useSubjects();
  const generate = useGenerateScheme();

  const [generateOpen, setGenerateOpen] = useState(false);

  // Hoisted so the memoised rows in `DataTable` are not invalidated by a
  // new handler identity on every render.
  const handleRowClick = useCallback(
    (scheme: SchemeSummary) => navigate(`/schemes/${scheme.id}`),
    [navigate],
  );

  const columns = useMemo<Column<SchemeSummary>[]>(
    () => [
      {
        id: 'scheme',
        header: 'Scheme',
        cell: (scheme) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {scheme.subjectName}
              <span className="font-normal text-muted-foreground"> · {scheme.className}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {scheme.termName} · {scheme.sessionName}
            </p>
          </div>
        ),
      },
      {
        id: 'weeks',
        header: 'Weeks',
        align: 'center',
        cell: (scheme) => <span className="tabular-nums">{scheme.weekCount}</span>,
      },
      {
        id: 'author',
        header: 'Written by',
        hideOnMobile: true,
        cell: (scheme) => scheme.createdByName,
      },
      {
        id: 'approved',
        header: 'Approved',
        hideOnMobile: true,
        cell: (scheme) =>
          scheme.approvedAt ? (
            <div className="text-xs">
              <p>{scheme.approvedByName}</p>
              <p className="text-muted-foreground">{formatDateTime(scheme.approvedAt)}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (scheme) => <StatusBadge status={scheme.status} />,
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Schemes of work"
        description="Term plans generated from the curriculum and the real number of teaching weeks, then edited by the teacher."
        breadcrumbs={[{ label: 'Teaching' }, { label: 'Schemes of work' }]}
        actions={
          can('scheme.manage') && (
            <Button data-cy="curriculum-schemes-generate-a-draft" onClick={() => setGenerateOpen(true)}>
              <Sparkles />
              Generate a draft
            </Button>
          )
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by subject or class…"
        isSearching={list.isSearchPending || schemes.isFetching}
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

        data-cy="curriculum-schemes-table"
        caption="Schemes of work by class and subject, with approval status"
        data={schemes.data?.items}
        meta={schemes.data?.meta}
        columns={columns}
        rowKey={(scheme) => scheme.id}
        isLoading={schemes.isPending}
        isFetching={schemes.isFetching}
        error={schemes.error}
        onRetry={() => void schemes.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={handleRowClick}
        emptyIcon={<ListChecks />}
        emptyTitle={list.isFiltered ? 'No schemes match those filters' : 'No schemes of work yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'Generate a draft from a curriculum, then adjust it to suit your class.'
        }
      />

      <GenerateSchemeDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerate={async (input) => {
          const scheme = await generate.mutateAsync(input);
          setGenerateOpen(false);
          navigate(`/schemes/${scheme.id}`);
        }}
        generating={generate.isPending}
      />
    </PageContainer>
  );
}
