import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardX,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatPercent } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses } from '@/features/academics/api';
import {
  useCurricula,
  useCurriculumCoverage,
  useCurriculumTopics,
  useDeleteObjective,
  useDeleteTopic,
  useMarkObjectiveCoverage,
  useSaveObjective,
  useSaveTopic,
} from './api';
import type { CurriculumTopic, LearningObjective } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatCard } from '@/components/data/stat-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';

const BLOOM_LEVELS = [
  'REMEMBER',
  'UNDERSTAND',
  'APPLY',
  'ANALYSE',
  'EVALUATE',
  'CREATE',
] as const;

/**
 * One curriculum, down to the objective.
 *
 * The point of this screen is the gap analysis: which objectives have been
 * taught, which have been assessed, and which have been quietly skipped. A
 * teacher ticks them off here; management reads the same data as coverage.
 */
export function CurriculumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get('classId') ?? '';

  const curricula = useCurricula();
  const topics = useCurriculumTopics(id);
  const coverage = useCurriculumCoverage({ curriculumId: id, classId: classId || undefined });
  const classes = useClasses();
  const markCoverage = useMarkObjectiveCoverage(id ?? '');
  const saveTopic = useSaveTopic(id ?? '');
  const deleteTopic = useDeleteTopic(id ?? '');
  const saveObjective = useSaveObjective(id ?? '');
  const deleteObjective = useDeleteObjective(id ?? '');

  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [topicDialog, setTopicDialog] = useState<{ open: boolean; topic?: CurriculumTopic }>({
    open: false,
  });
  const [objectiveDialog, setObjectiveDialog] = useState<{
    open: boolean;
    topicId?: string;
    objective?: LearningObjective;
  }>({ open: false });
  const [pendingDeleteTopic, setPendingDeleteTopic] = useState<CurriculumTopic | null>(null);
  const [pendingDeleteObjective, setPendingDeleteObjective] = useState<{
    topicId: string;
    objective: LearningObjective;
  } | null>(null);

  const curriculum = curricula.data?.find((entry) => entry.id === id);
  const canManage = can('curriculum.manage');

  const allObjectiveIds = useMemo(
    () => (topics.data ?? []).flatMap((topic) => topic.objectives.map((o) => o.id)),
    [topics.data],
  );

  const selectedObjectives = useMemo(() => {
    const all = (topics.data ?? []).flatMap((topic) => topic.objectives);
    return all.filter((objective) => selected.includes(objective.id));
  }, [topics.data, selected]);
  const canMarkAssessed = selectedObjectives.length > 0 && selectedObjectives.every((o) => o.taught);

  const toggleObjective = (objectiveId: string) =>
    setSelected((current) =>
      current.includes(objectiveId)
        ? current.filter((entry) => entry !== objectiveId)
        : [...current, objectiveId],
    );

  const toggleTopic = (topicObjectiveIds: string[]) =>
    setSelected((current) => {
      const allSelected = topicObjectiveIds.every((entry) => current.includes(entry));
      return allSelected
        ? current.filter((entry) => !topicObjectiveIds.includes(entry))
        : Array.from(new Set([...current, ...topicObjectiveIds]));
    });

  const applyCoverage = async (patch: { taught?: boolean; assessed?: boolean }) => {
    if (selected.length === 0) return;
    await markCoverage.mutateAsync({ objectiveIds: selected, ...patch });
    setSelected([]);
  };

  if (topics.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Loading curriculum…" />
      </PageContainer>
    );
  }

  if (topics.isError) {
    return (
      <PageContainer>
        <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={curriculum ? `${curriculum.subjectName} · ${curriculum.levelName}` : 'Curriculum'}
        description={curriculum?.description ?? 'Topics and the objectives beneath them.'}
        breadcrumbs={[
          { label: 'Curriculum', to: '/curriculum' },
          { label: curriculum?.subjectName ?? 'Curriculum' },
        ]}
        actions={
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="coverage-class" className="text-xs">
                Coverage for
              </Label>
              <NativeSelect
                id="coverage-class"
                value={classId}
                onChange={(event) =>
                  setSearchParams(
                    event.target.value ? { classId: event.target.value } : {},
                    { replace: true },
                  )
                }
                className="w-auto"
              >
                <option value="">All classes</option>
                {(classes.data ?? []).map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {canManage && (
              <Button onClick={() => setTopicDialog({ open: true })}>
                <Plus />
                Add topic
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Objectives"
          value={coverage.data?.totalObjectives ?? allObjectiveIds.length}
          icon={<Target />}
          loading={coverage.isPending}
        />
        <StatCard
          label="Taught"
          value={coverage.data ? formatPercent(coverage.data.coverageRate) : '—'}
          hint={coverage.data ? `${coverage.data.taughtCount} objectives` : undefined}
          tone={
            (coverage.data?.coverageRate ?? 0) >= 75
              ? 'success'
              : (coverage.data?.coverageRate ?? 0) >= 45
                ? 'warning'
                : 'danger'
          }
          loading={coverage.isPending}
        />
        <StatCard
          label="Taught but not assessed"
          value={coverage.data?.taughtNotAssessed ?? 0}
          hint="Covered in class, never tested"
          tone={(coverage.data?.taughtNotAssessed ?? 0) > 0 ? 'warning' : 'success'}
          loading={coverage.isPending}
        />
        <StatCard
          label="Never taught"
          value={coverage.data?.neverTaught ?? 0}
          hint="The syllabus gap"
          tone={(coverage.data?.neverTaught ?? 0) > 0 ? 'danger' : 'success'}
          loading={coverage.isPending}
        />
      </div>

      {selected.length > 0 && canManage && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle px-3 py-2">
          <p className="text-sm font-medium text-primary">
            {selected.length} objective{selected.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void applyCoverage({ taught: true })}
              loading={markCoverage.isPending}
            >
              <Check />
              Mark as taught
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void applyCoverage({ taught: false })}
              loading={markCoverage.isPending}
            >
              <X />
              Mark as not taught
            </Button>
            <Button
              size="sm"
              disabled={!canMarkAssessed}
              title={
                canMarkAssessed
                  ? undefined
                  : 'Mark the selection as taught first — an objective cannot be assessed before it is taught.'
              }
              onClick={() => void applyCoverage({ assessed: true })}
              loading={markCoverage.isPending}
            >
              <ClipboardCheck />
              Mark as assessed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void applyCoverage({ assessed: false })}
              loading={markCoverage.isPending}
            >
              <ClipboardX />
              Mark as not assessed
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => setSelected([])}
          >
            Clear
          </Button>
        </div>
      )}

      {(topics.data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title="No topics in this curriculum yet"
            description="Add topics and their learning objectives to start tracking coverage."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {topics.data?.map((topic) => {
            const objectiveIds = topic.objectives.map((objective) => objective.id);
            const taughtCount = topic.objectives.filter((objective) => objective.taught).length;
            const rate =
              topic.objectives.length === 0
                ? 0
                : (taughtCount / topic.objectives.length) * 100;
            const isOpen = expanded.includes(topic.id);
            const allSelected =
              objectiveIds.length > 0 && objectiveIds.every((entry) => selected.includes(entry));

            return (
              <Card key={topic.id}>
                <CardHeader className="gap-2 pb-2">
                  <div className="flex flex-wrap items-start gap-3">
                    {canManage && (
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleTopic(objectiveIds)}
                        aria-label={`Select all objectives in ${topic.title}`}
                        className="mt-1"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((current) =>
                          current.includes(topic.id)
                            ? current.filter((entry) => entry !== topic.id)
                            : [...current, topic.id],
                        )
                      }
                      aria-expanded={isOpen}
                      className="min-w-0 flex-1 text-left"
                    >
                      <CardTitle className="flex items-center gap-2">
                        <span className="truncate">
                          {topic.sequence}. {topic.title}
                        </span>
                        <ChevronDown
                          className={cn(
                            'size-4 shrink-0 text-muted-foreground transition-transform',
                            isOpen && 'rotate-180',
                          )}
                          aria-hidden="true"
                        />
                      </CardTitle>
                      <CardDescription>
                        {topic.objectives.length} objective
                        {topic.objectives.length === 1 ? '' : 's'} ·{' '}
                        {topic.suggestedWeeks} week{topic.suggestedWeeks === 1 ? '' : 's'} suggested
                      </CardDescription>
                    </button>
                    <div className="w-32 shrink-0">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Taught</span>
                        <span className="tabular-nums">
                          {taughtCount}/{topic.objectives.length}
                        </span>
                      </div>
                      <Progress
                        className="mt-1"
                        value={rate}
                        tone={rate === 100 ? 'success' : rate > 0 ? 'warning' : 'danger'}
                      />
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${topic.title}`}
                          onClick={() => setTopicDialog({ open: true, topic })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger hover:text-danger"
                          aria-label={`Delete ${topic.title}`}
                          onClick={() => setPendingDeleteTopic(topic)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="pt-0">
                    {topic.description && (
                      <p className="mb-3 text-sm text-muted-foreground">{topic.description}</p>
                    )}
                    {canManage && (
                      <div className="mb-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setObjectiveDialog({ open: true, topicId: topic.id })}
                        >
                          <Plus />
                          Add objective
                        </Button>
                      </div>
                    )}
                    {topic.objectives.length === 0 ? (
                      <EmptyState
                        compact
                        icon={<Target />}
                        title="No objectives in this topic yet"
                      />
                    ) : (
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {topic.objectives.map((objective) => (
                          <li
                            key={objective.id}
                            className="flex flex-wrap items-start gap-3 p-3 text-sm"
                          >
                            {canManage && (
                              <Checkbox
                                checked={selected.includes(objective.id)}
                                onCheckedChange={() => toggleObjective(objective.id)}
                                aria-label={`Select ${objective.code}`}
                                className="mt-0.5"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {objective.code}
                                </span>{' '}
                                {objective.statement}
                              </p>
                              {objective.taughtOn && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  Taught {formatDate(objective.taughtOn)}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-1.5">
                              {objective.bloomLevel && (
                                <Badge tone="outline">{objective.bloomLevel.toLowerCase()}</Badge>
                              )}
                              <Badge tone={objective.taught ? 'success' : 'neutral'}>
                                {objective.taught ? 'Taught' : 'Not taught'}
                              </Badge>
                              <Badge tone={objective.assessed ? 'primary' : 'neutral'}>
                                {objective.assessed ? 'Assessed' : 'Not assessed'}
                              </Badge>
                              {typeof objective.questionCount === 'number' &&
                                objective.questionCount > 0 && (
                                  <Badge tone="info">{objective.questionCount} questions</Badge>
                                )}
                            </div>
                            {canManage && (
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${objective.code}`}
                                  onClick={() =>
                                    setObjectiveDialog({
                                      open: true,
                                      topicId: topic.id,
                                      objective,
                                    })
                                  }
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-danger hover:text-danger"
                                  aria-label={`Delete ${objective.code}`}
                                  onClick={() =>
                                    setPendingDeleteObjective({ topicId: topic.id, objective })
                                  }
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <TopicDialog
        key={topicDialog.topic?.id ?? 'new-topic'}
        state={topicDialog}
        save={saveTopic}
        nextSequence={(topics.data?.length ?? 0) + 1}
        onClose={() => setTopicDialog({ open: false })}
      />
      <ObjectiveDialog
        key={`${objectiveDialog.topicId ?? 'none'}-${objectiveDialog.objective?.id ?? 'new'}`}
        state={objectiveDialog}
        save={saveObjective}
        onClose={() => setObjectiveDialog({ open: false })}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteTopic)}
        onOpenChange={(open) => !open && setPendingDeleteTopic(null)}
        title="Delete this topic?"
        description={`"${pendingDeleteTopic?.title}" and its ${pendingDeleteTopic?.objectives.length ?? 0} objective(s) will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteTopic.isPending}
        onConfirm={async () => {
          if (pendingDeleteTopic) await deleteTopic.mutateAsync(pendingDeleteTopic.id);
          setPendingDeleteTopic(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteObjective)}
        onOpenChange={(open) => !open && setPendingDeleteObjective(null)}
        title="Delete this objective?"
        description={`"${pendingDeleteObjective?.objective.statement}" will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteObjective.isPending}
        onConfirm={async () => {
          if (pendingDeleteObjective) {
            await deleteObjective.mutateAsync({
              topicId: pendingDeleteObjective.topicId,
              objectiveId: pendingDeleteObjective.objective.id,
            });
          }
          setPendingDeleteObjective(null);
        }}
      />
    </PageContainer>
  );
}

function TopicDialog({
  state,
  save,
  nextSequence,
  onClose,
}: {
  state: { open: boolean; topic?: CurriculumTopic };
  save: ReturnType<typeof useSaveTopic>;
  nextSequence: number;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(state.topic?.title ?? '');
  const [description, setDescription] = useState(state.topic?.description ?? '');
  const [sequence, setSequence] = useState(String(state.topic?.sequence ?? nextSequence));
  const [suggestedWeeks, setSuggestedWeeks] = useState(String(state.topic?.suggestedWeeks ?? 1));

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.topic ? 'Edit topic' : 'New topic'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic-title" required>
              Title
            </Label>
            <Input
              id="topic-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Photosynthesis"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic-description">Description</Label>
            <Textarea
              id="topic-description"
              value={description ?? ''}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="topic-sequence" required>
                Sequence
              </Label>
              <Input
                id="topic-sequence"
                type="number"
                min={1}
                value={sequence}
                onChange={(event) => setSequence(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-weeks">Suggested weeks</Label>
              <Input
                id="topic-weeks"
                type="number"
                min={1}
                value={suggestedWeeks}
                onChange={(event) => setSuggestedWeeks(event.target.value)}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!title.trim()}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.topic?.id,
                  values: {
                    title: title.trim(),
                    description: description.trim() || null,
                    sequence: Number(sequence) || nextSequence,
                    suggestedWeeks: Number(suggestedWeeks) || 1,
                  },
                })
                .then(onClose)
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObjectiveDialog({
  state,
  save,
  onClose,
}: {
  state: { open: boolean; topicId?: string; objective?: LearningObjective };
  save: ReturnType<typeof useSaveObjective>;
  onClose: () => void;
}) {
  const [statement, setStatement] = useState(state.objective?.statement ?? '');
  const [bloomLevel, setBloomLevel] = useState<string>(state.objective?.bloomLevel ?? '');

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.objective ? 'Edit objective' : 'New objective'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="objective-statement" required>
              Statement
            </Label>
            <Textarea
              id="objective-statement"
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="e.g. Define photosynthesis"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="objective-bloom">Bloom level</Label>
            <NativeSelect
              id="objective-bloom"
              value={bloomLevel}
              onChange={(event) => setBloomLevel(event.target.value)}
            >
              <option value="">Not set</option>
              {BLOOM_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </option>
              ))}
            </NativeSelect>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!statement.trim() || !state.topicId}
            onClick={() =>
              state.topicId &&
              void save
                .mutateAsync({
                  topicId: state.topicId,
                  id: state.objective?.id,
                  values: {
                    statement: statement.trim(),
                    bloomLevel: (bloomLevel || null) as LearningObjective['bloomLevel'],
                  },
                })
                .then(onClose)
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
