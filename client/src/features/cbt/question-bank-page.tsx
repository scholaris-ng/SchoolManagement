import { useMemo, useState } from 'react';
import { BookMarked, Plus, Trash2 } from 'lucide-react';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useSubjects } from '@/features/academics/api';
import { useDeleteQuestion, useQuestions, useSaveQuestion } from './api';
import type { Question } from '@/types/assessment';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog,
} from '@/components/ui/dialog';
import { TYPE_OPTIONS, DIFFICULTY_OPTIONS } from './question-bank-page-constants';
import { QuestionDialog } from './question-bank-page-parts';







/**
 * The question bank.
 *
 * Questions are tied to a subject, topic and — where the school has modelled it
 * — an individual learning objective, which is what lets curriculum coverage
 * distinguish "taught" from "actually assessed" (spec section 13).
 */
export function QuestionBankPage() {
  const list = useListQuery({ filterKeys: ['subjectId', 'difficulty', 'type'] });
  const questions = useQuestions(list.query);
  const subjects = useSubjects();
  const saveQuestion = useSaveQuestion();
  const deleteQuestion = useDeleteQuestion();

  const [editing, setEditing] = useState<{ open: boolean; question?: Question }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);

  const columns = useMemo<Column<Question>[]>(
    () => [
      {
        id: 'question',
        header: 'Question',
        cell: (question) => (
          <div className="min-w-0">
            <button
              type="button"
              data-cy={`question-bank-edit-${question.id}`}
              onClick={(event) => {
                event.stopPropagation();
                setEditing({ open: true, question });
              }}
              className="block max-w-md truncate text-left font-medium hover:text-primary hover:underline"
            >
              {question.text}
            </button>
            <p className="truncate text-xs text-muted-foreground">
              {question.subjectName}
              {question.topicTitle ? ` · ${question.topicTitle}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: (question) => <Badge tone="neutral">{humanizeEnum(question.type)}</Badge>,
      },
      {
        id: 'difficulty',
        header: 'Difficulty',
        hideOnMobile: true,
        cell: (question) => (
          <Badge
            tone={
              question.difficulty === 'EASY'
                ? 'success'
                : question.difficulty === 'MEDIUM'
                  ? 'warning'
                  : 'danger'
            }
          >
            {humanizeEnum(question.difficulty)}
          </Badge>
        ),
      },
      {
        id: 'objective',
        header: 'Objective',
        hideOnMobile: true,
        cell: (question) =>
          question.objectiveStatement ? (
            <span className="line-clamp-2 max-w-xs text-xs">{question.objectiveStatement}</span>
          ) : (
            <span className="text-muted-foreground">Not linked</span>
          ),
      },
      {
        id: 'marks',
        header: 'Marks',
        align: 'center',
        cell: (question) => <span className="tabular-nums">{question.marks}</span>,
      },
      {
        id: 'usage',
        header: 'Used',
        align: 'center',
        hideOnMobile: true,
        cell: (question) => <span className="tabular-nums">{question.usageCount}</span>,
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        hideOnMobile: true,
        cell: (question) => (
          <Button
            variant="ghost"
            size="icon-sm"
            data-cy={`question-bank-delete-${question.id}`}
            aria-label={`Delete question: ${question.text.slice(0, 40)}`}
            onClick={(event) => {
              event.stopPropagation();
              setPendingDelete(question);
            }}
          >
            <Trash2 />
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Question bank"
        description="Reusable questions, tagged by subject, topic and objective."
        breadcrumbs={[{ label: 'Assessment' }, { label: 'Question bank' }]}
        actions={
          <Button data-cy="cbt-question-bank-new-question" onClick={() => setEditing({ open: true })}>
            <Plus />
            New question
          </Button>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search question text…"
        isSearching={list.isSearchPending || questions.isFetching}
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          {
            key: 'subjectId',
            label: 'Subject',
            options: (subjects.data ?? []).map((s) => ({ value: s.id, label: s.name })),
          },
          { key: 'type', label: 'Type', options: TYPE_OPTIONS, allLabel: 'All types' },
          {
            key: 'difficulty',
            label: 'Difficulty',
            options: DIFFICULTY_OPTIONS,
            allLabel: 'All difficulties',
          },
        ]}
      />

      <DataTable

        data-cy="cbt-question-bank-table"
        caption="Question bank with subject, type, difficulty and linked objective"
        data={questions.data?.items}
        meta={questions.data?.meta}
        columns={columns}
        rowKey={(question) => question.id}
        isLoading={questions.isPending}
        isFetching={questions.isFetching}
        error={questions.error}
        onRetry={() => void questions.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        emptyIcon={<BookMarked />}
        emptyTitle={list.isFiltered ? 'No questions match those filters' : 'No questions yet'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'Build a bank once and reuse it across practice papers and examinations.'
        }
        emptyAction={
          <Button data-cy="cbt-question-bank-add-the-first-question" onClick={() => setEditing({ open: true })}>
            <Plus />
            Add the first question
          </Button>
        }
      />

      <QuestionDialog
        key={editing.question?.id ?? 'new'}
        state={editing}
        subjects={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
        saving={saveQuestion.isPending}
        onClose={() => setEditing({ open: false })}
        onSave={async (values) => {
          await saveQuestion.mutateAsync({ id: editing.question?.id, values });
          setEditing({ open: false });
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this question?"
        description="It will be removed from the bank. Papers that already used it keep the marks students earned."
        confirmLabel="Delete"
        tone="danger"
        loading={deleteQuestion.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteQuestion.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </PageContainer>
  );
}
