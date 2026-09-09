import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Sparkles } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses, useCurrentTerm, useSubjects, useTerms } from '@/features/academics/api';
import { useCurricula, useGenerateScheme, useSchemes, type SchemeSummary } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/primitives';
import { NativeSelect } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';

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
            <Button onClick={() => setGenerateOpen(true)}>
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
        onRowClick={(scheme) => navigate(`/schemes/${scheme.id}`)}
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

function GenerateSchemeDialog({
  open,
  onOpenChange,
  onGenerate,
  generating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (input: { curriculumId: string; classId: string; termId: string }) => Promise<void>;
  generating: boolean;
}) {
  const curricula = useCurricula();
  const terms = useTerms();
  const currentTerm = useCurrentTerm();

  const [curriculumId, setCurriculumId] = useState('');
  const [termId, setTermId] = useState('');

  // The class is the curriculum's own; asking again could only produce a
  // scheme for a class the plan was never written for.
  const curriculum = curricula.data?.find((entry) => entry.id === curriculumId);
  const effectiveTermId = termId || currentTerm.data?.id || '';
  const term = terms.data?.find((entry) => entry.id === effectiveTermId);
  const valid = Boolean(curriculum && effectiveTermId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Generate a draft scheme of work</DialogTitle>
          <DialogDescription>
            Objectives from the curriculum are spread across the term&rsquo;s teaching weeks. It is
            a starting point — you can reorder, merge and rewrite every week afterwards.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gen-curriculum" required>
              Curriculum
            </Label>
            <NativeSelect
              id="gen-curriculum"
              value={curriculumId}
              onChange={(event) => setCurriculumId(event.target.value)}
            >
              <option value="">Select a curriculum</option>
              {(curricula.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.subjectName} · {entry.className} ({entry.objectiveCount} objectives)
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {curriculum
                ? `Written by ${curriculum.createdByName} for ${curriculum.className}.`
                : 'Each curriculum already names the class it was written for.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gen-term" required>
              Term
            </Label>
            <NativeSelect
              id="gen-term"
              value={effectiveTermId}
              onChange={(event) => setTermId(event.target.value)}
            >
              <option value="">Select a term</option>
              {(terms.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.sessionName} ({entry.teachingWeeks} weeks)
                </option>
              ))}
            </NativeSelect>
          </div>

          {term && (
            <Alert tone="info">
              {term.name} has {term.teachingWeeks} teaching weeks. The draft will use those dates,
              not a generic twelve-week assumption.
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={generating}
            loadingLabel="Generating…"
            disabled={!valid}
            onClick={() =>
              void onGenerate({
                curriculumId,
                classId: curriculum?.classId ?? '',
                termId: effectiveTermId,
              })
            }
          >
            Generate draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
