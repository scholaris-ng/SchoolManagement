import { useMemo, useState } from 'react';
import { BookMarked, Plus, Trash2 } from 'lucide-react';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useSubjects } from '@/features/academics/api';
import { useDeleteQuestion, useQuestions, useSaveQuestion } from './api';
import type { Question, QuestionOption, QuestionType } from '@/types/assessment';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { Badge, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const TYPE_OPTIONS = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { value: 'TRUE_FALSE', label: 'True or false' },
  { value: 'SHORT_ANSWER', label: 'Short answer' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

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

function QuestionDialog({
  state,
  subjects,
  saving,
  onClose,
  onSave,
}: {
  state: { open: boolean; question?: Question };
  subjects: { value: string; label: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: Partial<Question>) => Promise<void>;
}) {
  const [text, setText] = useState(state.question?.text ?? '');
  const [subjectId, setSubjectId] = useState(state.question?.subjectId ?? '');
  const [type, setType] = useState<QuestionType>(state.question?.type ?? 'MULTIPLE_CHOICE');
  const [difficulty, setDifficulty] = useState(state.question?.difficulty ?? 'MEDIUM');
  const [marks, setMarks] = useState(String(state.question?.marks ?? 1));
  const [explanation, setExplanation] = useState(state.question?.explanation ?? '');
  const [shortAnswer, setShortAnswer] = useState(state.question?.correctAnswer ?? '');
  const [options, setOptions] = useState<QuestionOption[]>(
    state.question?.options.length
      ? state.question.options
      : [
          { id: 'opt-a', label: 'A', text: '', isCorrect: true },
          { id: 'opt-b', label: 'B', text: '', isCorrect: false },
          { id: 'opt-c', label: 'C', text: '', isCorrect: false },
          { id: 'opt-d', label: 'D', text: '', isCorrect: false },
        ],
  );

  const effectiveOptions: QuestionOption[] =
    type === 'TRUE_FALSE'
      ? [
          { id: 'opt-true', label: 'A', text: 'True', isCorrect: options[0]?.isCorrect ?? true },
          { id: 'opt-false', label: 'B', text: 'False', isCorrect: !(options[0]?.isCorrect ?? true) },
        ]
      : options;

  const valid =
    text.trim() &&
    subjectId &&
    (type === 'SHORT_ANSWER'
      ? shortAnswer.trim()
      : effectiveOptions.filter((option) => option.text.trim()).length >= 2 &&
        effectiveOptions.some((option) => option.isCorrect));

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{state.question ? 'Edit question' : 'New question'}</DialogTitle>
          <DialogDescription>
            Objective questions are marked automatically. Short answers are marked by a teacher.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-text" required>
              Question
            </Label>
            <Textarea
              data-cy="q-text"
              id="q-text"
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="q-subject" required>
                Subject
              </Label>
              <NativeSelect
                data-cy="q-subject"
                id="q-subject"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">Select</option>
                {subjects.map((subject) => (
                  <option key={subject.value} value={subject.value}>
                    {subject.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-type">Type</Label>
              <NativeSelect
                data-cy="q-type"
                id="q-type"
                value={type}
                onChange={(event) => setType(event.target.value as QuestionType)}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-difficulty">Difficulty</Label>
              <NativeSelect
                data-cy="q-difficulty"
                id="q-difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as Question['difficulty'])}
              >
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-marks">Marks</Label>
              <Input
                data-cy="q-marks"
                id="q-marks"
                type="number"
                min={1}
                value={marks}
                onChange={(event) => setMarks(event.target.value)}
              />
            </div>
          </div>

          {type === 'SHORT_ANSWER' ? (
            <div className="space-y-1.5">
              <Label htmlFor="q-answer" required>
                Expected answer
              </Label>
              <Input
                data-cy="q-answer"
                id="q-answer"
                value={shortAnswer}
                onChange={(event) => setShortAnswer(event.target.value)}
                placeholder="What a correct answer should contain"
              />
            </div>
          ) : type === 'TRUE_FALSE' ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Correct answer</legend>
              {['True', 'False'].map((label, index) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input
                    data-cy="cbt-question-bank-is-correct"
                    type="radio"
                    name="true-false"
                    checked={index === 0 ? (options[0]?.isCorrect ?? true) : !(options[0]?.isCorrect ?? true)}
                    onChange={() =>
                      setOptions([
                        { id: 'opt-true', label: 'A', text: 'True', isCorrect: index === 0 },
                        { id: 'opt-false', label: 'B', text: 'False', isCorrect: index !== 0 },
                      ])
                    }
                    className="size-4"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Options <span className="font-normal text-muted-foreground">(mark the correct one)</span>
              </legend>
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    data-cy="cbt-question-bank-is-correct-2"
                    type="radio"
                    name="correct-option"
                    checked={option.isCorrect}
                    aria-label={`Option ${OPTION_LABELS[index]} is correct`}
                    onChange={() =>
                      setOptions((current) =>
                        current.map((entry, i) => ({ ...entry, isCorrect: i === index })),
                      )
                    }
                    className="size-4 shrink-0"
                  />
                  <span className="w-5 shrink-0 text-sm font-medium text-muted-foreground">
                    {OPTION_LABELS[index]}
                  </span>
                  <Input
                    data-cy="cbt-question-bank-text"
                    value={option.text}
                    aria-label={`Option ${OPTION_LABELS[index]}`}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, text: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </fieldset>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="q-explanation">Explanation</Label>
            <Textarea
              data-cy="q-explanation"
              id="q-explanation"
              rows={2}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              placeholder="Shown to students after a practice attempt."
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="cbt-question-bank-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="cbt-question-bank-save-question"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                text: text.trim(),
                subjectId,
                type,
                difficulty: difficulty as Question['difficulty'],
                marks: Number(marks) || 1,
                explanation: explanation.trim() || null,
                correctAnswer: type === 'SHORT_ANSWER' ? shortAnswer.trim() : null,
                options: type === 'SHORT_ANSWER' ? [] : effectiveOptions,
              })
            }
          >
            Save question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
