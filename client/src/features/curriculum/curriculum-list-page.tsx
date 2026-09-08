import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { useLevels, useSubjects } from '@/features/academics/api';
import { useCurricula, useDeleteCurriculum, useSaveCurriculum } from './api';
import type { Curriculum } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { FilterBar } from '@/components/data/filter-bar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect, Textarea, Input } from '@/components/ui/input';
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';

/**
 * Every curriculum the school has defined, one card each.
 *
 * The number that matters is coverage — how much of the syllabus has actually
 * been taught — so it is on the card rather than two clicks away.
 */
export function CurriculumListPage() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectId = searchParams.get('subjectId') ?? undefined;
  const levelId = searchParams.get('levelId') ?? undefined;

  const curricula = useCurricula({ subjectId, levelId });
  const subjects = useSubjects();
  const levels = useLevels();
  const deleteCurriculum = useDeleteCurriculum();

  const canManage = can('curriculum.manage');
  const [curriculumDialog, setCurriculumDialog] = useState<{
    open: boolean;
    curriculum?: Curriculum;
  }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Curriculum | null>(null);

  const setFilter = (key: string, value: string | undefined) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Curriculum"
        description="Subjects broken down into topics and the individual objectives a child is expected to master."
        breadcrumbs={[{ label: 'Teaching' }, { label: 'Curriculum' }]}
        actions={
          canManage && (
            <Button onClick={() => setCurriculumDialog({ open: true })}>
              <Plus />
              New curriculum
            </Button>
          )
        }
      />

      <FilterBar
        values={{ subjectId, levelId }}
        onFilterChange={setFilter}
        onReset={subjectId || levelId ? () => setSearchParams({}, { replace: true }) : undefined}
        filters={[
          {
            key: 'subjectId',
            label: 'Subject',
            options: (subjects.data ?? []).map((subject) => ({
              value: subject.id,
              label: subject.name,
            })),
          },
          {
            key: 'levelId',
            label: 'Level',
            options: (levels.data ?? []).map((level) => ({ value: level.id, label: level.name })),
          },
        ]}
      />

      {curricula.isPending ? (
        <LoadingState label="Loading curricula…" />
      ) : curricula.isError ? (
        <ErrorState error={curricula.error} onRetry={() => void curricula.refetch()} />
      ) : (curricula.data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Target />}
            title="No curriculum defined yet"
            description="A curriculum links a subject and a level to the topics and objectives it covers. It is what makes coverage reporting and scheme generation possible."
            action={
              canManage ? (
                <Button onClick={() => setCurriculumDialog({ open: true })}>
                  <Plus />
                  New curriculum
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curricula.data?.map((curriculum) => {
            // Coverage is reported per class; the card shows the shape of the
            // curriculum itself, and the detail page resolves it per class.
            const objectiveDensity =
              curriculum.topicCount === 0
                ? 0
                : curriculum.objectiveCount / curriculum.topicCount;
            return (
              <Card key={curriculum.id} className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{curriculum.subjectName}</CardTitle>
                    <CardDescription>
                      {curriculum.levelName}
                      {curriculum.name !== curriculum.subjectName ? ` · ${curriculum.name}` : ''}
                    </CardDescription>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${curriculum.subjectName}`}
                        onClick={() => setCurriculumDialog({ open: true, curriculum })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-danger hover:text-danger"
                        aria-label={`Delete ${curriculum.subjectName}`}
                        onClick={() => setPendingDelete(curriculum)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  {curriculum.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {curriculum.description}
                    </p>
                  )}

                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border border-border p-2">
                      <dt className="text-xs text-muted-foreground">Topics</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {curriculum.topicCount}
                      </dd>
                    </div>
                    <div className="rounded-md border border-border p-2">
                      <dt className="text-xs text-muted-foreground">Objectives</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {curriculum.objectiveCount}
                      </dd>
                    </div>
                  </dl>

                  <p className="text-xs text-muted-foreground">
                    About {objectiveDensity.toFixed(1)} objectives per topic
                  </p>

                  <div className="mt-auto pt-2">
                    <Button variant="outline" block asChild>
                      <Link to={`/curriculum/${curriculum.id}`}>
                        Open curriculum
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CurriculumDialog
        key={curriculumDialog.curriculum?.id ?? 'new-curriculum'}
        state={curriculumDialog}
        subjects={subjects.data ?? []}
        levels={levels.data ?? []}
        onClose={() => setCurriculumDialog({ open: false })}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this curriculum?"
        description={`"${pendingDelete?.subjectName} · ${pendingDelete?.levelName}" and all of its topics and objectives will be permanently removed. This cannot be undone if any coverage has been recorded against it.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteCurriculum.isPending}
        onConfirm={async () => {
          if (pendingDelete) await deleteCurriculum.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </PageContainer>
  );
}

function CurriculumDialog({
  state,
  subjects,
  levels,
  onClose,
}: {
  state: { open: boolean; curriculum?: Curriculum };
  subjects: { id: string; name: string }[];
  levels: { id: string; name: string }[];
  onClose: () => void;
}) {
  const save = useSaveCurriculum();
  const [subjectId, setSubjectId] = useState(state.curriculum?.subjectId ?? subjects[0]?.id ?? '');
  const [levelId, setLevelId] = useState(state.curriculum?.levelId ?? levels[0]?.id ?? '');
  const [name, setName] = useState(state.curriculum?.name ?? '');
  const [description, setDescription] = useState(state.curriculum?.description ?? '');

  const valid = Boolean(subjectId && levelId);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.curriculum ? 'Edit curriculum' : 'New curriculum'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="curriculum-subject" required>
                Subject
              </Label>
              <NativeSelect
                id="curriculum-subject"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="curriculum-level" required>
                Level
              </Label>
              <NativeSelect
                id="curriculum-level"
                value={levelId}
                onChange={(event) => setLevelId(event.target.value)}
              >
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curriculum-name">Name</Label>
            <Input
              id="curriculum-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Defaults to the subject and level"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curriculum-description">Description</Label>
            <Textarea
              id="curriculum-description"
              value={description ?? ''}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this curriculum covers"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.curriculum?.id,
                  values: {
                    subjectId,
                    levelId,
                    name: name.trim() || undefined,
                    description: description.trim() || null,
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
