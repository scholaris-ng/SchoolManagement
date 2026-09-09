import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardX,
  Pencil,
  Plus,
  Target,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatPercent } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
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
import {
  BLOOM_LEVELS,
  BLOOM_UNSET,
  bloom,
  bloomBreakdown,
  bloomLabel,
  type BloomLevel,
} from './bloom';
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
import { Input, Select, Textarea } from '@/components/ui/input';
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
import { EmptyState, ErrorState, LoadingState, Tooltip } from '@/components/ui/feedback';


/**
 * One curriculum, down to the objective.
 *
 * The point of this screen is the gap analysis: which objectives have been
 * taught, which have been assessed, and which have been quietly skipped. A
 * teacher ticks them off here; management reads the same data as coverage.
 */
export function CurriculumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();

  // Looked up by id, so this must not be narrowed to the current session — a
  // link to last year's plan has to keep opening it.
  const curricula = useCurricula({ sessionId: 'ALL' });
  const topics = useCurriculumTopics(id);
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
  // Keying the dialogs below on `topic?.id`/`objective?.id` alone remounts
  // them when switching between two *different* records, but every "Add
  // topic" (or "Add objective" on the same topic) shares the same "new"
  // identity — so without this, reopening either dialog reused the same
  // component instance and its state, leaving whatever was typed (or
  // discarded) last time still sitting in the field. Bumped on every open,
  // add or edit alike, so each open is a genuinely fresh form.
  const [topicDialogSeq, setTopicDialogSeq] = useState(0);
  const [objectiveDialogSeq, setObjectiveDialogSeq] = useState(0);
  const [pendingDeleteTopic, setPendingDeleteTopic] = useState<CurriculumTopic | null>(null);
  const [pendingDeleteObjective, setPendingDeleteObjective] = useState<{
    topicId: string;
    objective: LearningObjective;
  } | null>(null);

  const curriculum = curricula.data?.find((entry) => entry.id === id);
  // Coverage is read for the class the curriculum was written for; there is no
  // longer a second, contradictable answer to "which class?".
  const coverage = useCurriculumCoverage({ curriculumId: id });

  const isMine = Boolean(curriculum && curriculum.createdById === user?.id);
  // The list a teacher receives is already narrowed to what they teach or
  // wrote, so anything reachable here is theirs to maintain.
  const canManage = can('curriculum.manage');

  const allObjectives = useMemo(
    () => (topics.data ?? []).flatMap((topic) => topic.objectives),
    [topics.data],
  );
  const allObjectiveIds = useMemo(
    () => allObjectives.map((objective) => objective.id),
    [allObjectives],
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
        title={curriculum ? `${curriculum.subjectName} · ${curriculum.className}` : 'Curriculum'}
        description={curriculum?.description ?? 'Topics and the objectives beneath them.'}
        breadcrumbs={[
          { label: 'Curriculum', to: '/curriculum' },
          { label: curriculum?.subjectName ?? 'Curriculum' },
        ]}
        actions={
          canManage && (
            <Button
              data-cy="curriculum-detail-add-topic"
              onClick={() => {
                setTopicDialogSeq((n) => n + 1);
                setTopicDialog({ open: true });
              }}
            >
              <Plus />
              Add topic
            </Button>
          )
        }
      />

      {curriculum && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{curriculum.className}</span>
            <span className="text-muted-foreground">({curriculum.levelName})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{curriculum.sessionName}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <UserRound className="size-4" aria-hidden="true" />
            Written by{' '}
            <span className="font-medium text-foreground">{curriculum.createdByName}</span>
            <span>· {curriculum.createdByRole}</span>
            <span>· {formatDate(curriculum.createdAt)}</span>
          </span>
          {isMine && <Badge tone="success">Yours</Badge>}
        </div>
      )}

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

      <ThinkingDemandCard objectives={allObjectives} />

      {selected.length > 0 && canManage && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle px-3 py-2">
          <p className="text-sm font-medium text-primary">
            {selected.length} objective{selected.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Tooltip content="Records that the selected objectives have been covered in class.">
              <Button
                data-cy="curriculum-detail-mark-as-taught"
                size="sm"
                onClick={() => void applyCoverage({ taught: true })}
                loading={markCoverage.isPending}
              >
                <Check />
                Mark as taught
              </Button>
            </Tooltip>
            <Tooltip content="Reverses 'taught' — use this to correct a mark made by mistake.">
              <Button
                data-cy="curriculum-detail-mark-as-not-taught"
                size="sm"
                variant="outline"
                onClick={() => void applyCoverage({ taught: false })}
                loading={markCoverage.isPending}
              >
                <X />
                Mark as not taught
              </Button>
            </Tooltip>
            <Tooltip
              content={
                canMarkAssessed
                  ? 'Records that students have been tested on the selected objectives, not just taught them.'
                  : 'Mark the selection as taught first — an objective cannot be assessed before it is taught.'
              }
            >
              <Button
                data-cy="curriculum-detail-mark-as-assessed"
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
            </Tooltip>
            <Tooltip content="Reverses 'assessed' — use this to correct a mark made by mistake.">
              <Button
                data-cy="curriculum-detail-mark-as-not-assessed"
                size="sm"
                variant="outline"
                onClick={() => void applyCoverage({ assessed: false })}
                loading={markCoverage.isPending}
              >
                <ClipboardX />
                Mark as not assessed
              </Button>
            </Tooltip>
          </div>
          <Button
            data-cy="curriculum-detail-clear"
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
                        data-cy="curriculum-detail-all-selected"
                        checked={allSelected}
                        onCheckedChange={() => toggleTopic(objectiveIds)}
                        aria-label={`Select all objectives in ${topic.title}`}
                        className="mt-1"
                      />
                    )}
                    <button
                      data-cy="curriculum-detail-objective-week-suggested"
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
                          data-cy={`curriculum-topic-edit-${topic.id}`}
                          aria-label={`Edit ${topic.title}`}
                          onClick={() => {
                            setTopicDialogSeq((n) => n + 1);
                            setTopicDialog({ open: true, topic });
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger hover:text-danger"
                          data-cy={`curriculum-topic-delete-${topic.id}`}
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
                          data-cy="curriculum-detail-add-objective"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setObjectiveDialogSeq((n) => n + 1);
                            setObjectiveDialog({ open: true, topicId: topic.id });
                          }}
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
                                data-cy="curriculum-detail-id"
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
                                <Badge
                                  tone="outline"
                                  title={bloom(objective.bloomLevel)?.hint}
                                >
                                  {bloomLabel(objective.bloomLevel)}
                                </Badge>
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
                                  data-cy={`curriculum-objective-edit-${objective.id}`}
                                  aria-label={`Edit ${objective.code}`}
                                  onClick={() => {
                                    setObjectiveDialogSeq((n) => n + 1);
                                    setObjectiveDialog({
                                      open: true,
                                      topicId: topic.id,
                                      objective,
                                    });
                                  }}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-danger hover:text-danger"
                                  data-cy={`curriculum-objective-delete-${objective.id}`}
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
        key={`${topicDialog.topic?.id ?? 'new-topic'}-${topicDialogSeq}`}
        state={topicDialog}
        save={saveTopic}
        nextSequence={(topics.data?.length ?? 0) + 1}
        onClose={() => setTopicDialog({ open: false })}
      />
      <ObjectiveDialog
        key={`${objectiveDialog.topicId ?? 'none'}-${objectiveDialog.objective?.id ?? 'new'}-${objectiveDialogSeq}`}
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
              data-cy="topic-title"
              id="topic-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Photosynthesis"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic-description">Description</Label>
            <Textarea
              data-cy="topic-description"
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
                data-cy="topic-sequence"
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
                data-cy="topic-weeks"
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
          <Button data-cy="curriculum-detail-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="curriculum-detail-save"
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

/**
 * How the objectives are spread across the six Bloom levels.
 *
 * Coverage answers "did we teach it?". This answers the question a coverage
 * percentage cannot: "what were we asking them to do?" A syllabus fully taught
 * but written entirely at Remember and Understand looks finished and is not,
 * and the exam is the wrong place to discover that.
 */
function ThinkingDemandCard({ objectives }: { objectives: LearningObjective[] }) {
  const breakdown = useMemo(() => bloomBreakdown(objectives), [objectives]);
  if (breakdown.total === 0) return null;

  const busiest = Math.max(...breakdown.counts.map((entry) => entry.count), 1);
  const everythingUntagged = breakdown.tagged === 0;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Thinking demand</CardTitle>
          <CardDescription>
            What these objectives ask a child to do, from recalling a fact to building
            something new.
          </CardDescription>
        </div>
        {!everythingUntagged && (
          <Badge
            tone={
              breakdown.higherOrderShare >= 30
                ? 'success'
                : breakdown.higherOrderShare > 0
                  ? 'warning'
                  : 'danger'
            }
          >
            {Math.round(breakdown.higherOrderShare)}% higher order
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {everythingUntagged ? (
          <p className="text-sm text-muted-foreground">
            None of the {breakdown.total} objectives carry a thinking level yet. Set one while
            editing an objective and this fills in.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {breakdown.counts.map(({ definition, count, share }) => (
              <li key={definition.value} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 truncate" title={definition.hint}>
                  {definition.label}
                </span>
                {/* A bar against the busiest level rather than the total, so
                    the smaller levels stay visible instead of vanishing. */}
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      definition.higherOrder ? 'bg-primary' : 'bg-muted-foreground/40',
                    )}
                    style={{ width: `${(count / busiest) * 100}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                  {count} · {Math.round(share)}%
                </span>
              </li>
            ))}
          </ul>
        )}

        {!everythingUntagged && breakdown.higherOrder === 0 && (
          <p className="text-sm text-warning">
            Every tagged objective sits at Remember, Understand or Apply. Nothing here asks a
            child to compare, judge or design, which is what the harder exam questions want.
          </p>
        )}

        {breakdown.untagged > 0 && (
          <p className="text-xs text-muted-foreground">
            {breakdown.untagged} of {breakdown.total} objectives are not tagged yet, so the
            shares above are of the {breakdown.tagged} that are.
          </p>
        )}
      </CardContent>
    </Card>
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
  const [bloomLevel, setBloomLevel] = useState<string>(
    state.objective?.bloomLevel ?? BLOOM_UNSET,
  );

  const chosen = bloomLevel === BLOOM_UNSET ? null : bloom(bloomLevel as BloomLevel);

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
              data-cy="objective-statement"
              id="objective-statement"
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="e.g. Define photosynthesis"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="objective-bloom">Thinking level</Label>
            <Select
              data-cy="objective-bloom"
              id="objective-bloom"
              value={bloomLevel}
              onValueChange={setBloomLevel}
              aria-label="Thinking level"
              options={[
                {
                  value: BLOOM_UNSET,
                  label: 'Not set',
                  description: 'Decide later',
                },
                ...BLOOM_LEVELS.map((level) => ({
                  value: level.value,
                  label: level.label,
                  description: level.hint,
                })),
              ]}
            />
            {/* The verbs are what a teacher actually recognises their own
                objective by, so they matter more here than the definition. */}
            <p className="text-xs text-muted-foreground">
              {chosen ? (
                <>
                  How hard this makes a child think. Usually written as{' '}
                  <span className="font-medium text-foreground">
                    {chosen.verbs.slice(0, 3).join(', ')}
                  </span>
                  . For example: {chosen.example}
                </>
              ) : (
                'Optional. Tagging how hard each objective makes a child think is what shows whether a syllabus trains recall or reasoning.'
              )}
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="curriculum-detail-cancel-2" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="curriculum-detail-save-2"
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
                    bloomLevel:
                      bloomLevel === BLOOM_UNSET
                        ? null
                        : (bloomLevel as LearningObjective['bloomLevel']),
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
