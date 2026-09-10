import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Pencil, Plus, Target, Trash2, UserRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import {
  useAcademicSessions,
  useClasses,
  useLevels,
  useSubjects,
} from '@/features/academics/api';
import { useCurricula, useDeleteCurriculum } from './api';
import type { Curriculum } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { formatDate } from '@/lib/format';
import { FilterBar } from '@/components/data/filter-bar';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog,
} from '@/components/ui/dialog';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { CurriculumDialog } from './curriculum-list-page-parts';

/**
 * Every curriculum the school has defined, one card each.
 *
 * The number that matters is coverage — how much of the syllabus has actually
 * been taught — so it is on the card rather than two clicks away.
 */
export function CurriculumListPage() {
  const { can, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectId = searchParams.get('subjectId') ?? undefined;
  const levelId = searchParams.get('levelId') ?? undefined;
  const classId = searchParams.get('classId') ?? undefined;
  const mineOnly = searchParams.get('mine') === '1';
  // No session in the URL means the school's current one, chosen by the server.
  const sessionId = searchParams.get('sessionId') ?? undefined;

  const curricula = useCurricula({
    subjectId,
    levelId,
    classId,
    sessionId,
    createdById: mineOnly ? (user?.id ?? undefined) : undefined,
  });
  const subjects = useSubjects();
  const levels = useLevels();
  // Only the classes this user teaches, so the filter never offers a class
  // whose curriculum they could not open anyway.
  const classes = useClasses({ levelId });
  const sessions = useAcademicSessions();
  const deleteCurriculum = useDeleteCurriculum();

  const currentSession = sessions.data?.find((session) => session.isCurrent);
  const shownSession = sessionId
    ? sessions.data?.find((session) => session.id === sessionId)
    : currentSession;
  const viewingPastSession = Boolean(
    sessionId && sessionId !== 'ALL' && sessionId !== currentSession?.id,
  );

  const canManage = can('curriculum.manage');
  const canManageAcademics = can('academics.manage');
  const isFiltered = Boolean(subjectId || levelId || classId || mineOnly || sessionId);
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
        description={
          sessionId === 'ALL'
            ? 'Every session the school has planned, from the topics down to the individual objectives.'
            : `Subjects broken down into topics and objectives, for ${shownSession?.name ?? 'the current session'}.`
        }
        breadcrumbs={[{ label: 'Teaching' }, { label: 'Curriculum' }]}
        actions={
          canManage && (
            <Button data-cy="curriculum-list-new-curriculum" onClick={() => setCurriculumDialog({ open: true })}>
              <Plus />
              New curriculum
            </Button>
          )
        }
      />

      {viewingPastSession && (
        <Alert tone="info">
          Showing {shownSession?.name ?? 'another session'}. A new curriculum is always written for{' '}
          {currentSession?.name ?? 'the current session'}, the session the school is working in.
        </Alert>
      )}

      <FilterBar
        values={{ subjectId, levelId, classId, sessionId }}
        onFilterChange={setFilter}
        onReset={isFiltered ? () => setSearchParams({}, { replace: true }) : undefined}
        filters={[
          {
            key: 'sessionId',
            label: 'Session',
            allLabel: currentSession ? `${currentSession.name} (current)` : 'Current session',
            options: [
              ...(sessions.data ?? [])
                .filter((session) => !session.isCurrent)
                .map((session) => ({ value: session.id, label: session.name })),
              { value: 'ALL', label: 'Every session' },
            ],
          },
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
          {
            key: 'classId',
            label: 'Class',
            options: (classes.data ?? []).map((schoolClass) => ({
              value: schoolClass.id,
              label: schoolClass.name,
            })),
          },
        ]}
      >
        <Button
          data-cy="curriculum-list-written-by-me"
          variant={mineOnly ? 'primary' : 'outline'}
          size="sm"
          className="h-9"
          aria-pressed={mineOnly}
          onClick={() => setFilter('mine', mineOnly ? undefined : '1')}
        >
          <UserRound />
          Written by me
        </Button>
      </FilterBar>

      {curricula.isPending ? (
        <LoadingState label="Loading curricula…" />
      ) : curricula.isError ? (
        <ErrorState error={curricula.error} onRetry={() => void curricula.refetch()} />
      ) : (curricula.data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Target />}
            title={isFiltered ? 'No curriculum matches those filters' : 'No curriculum defined yet'}
            description="A curriculum ties one subject, for one class, to the topics and objectives it covers. It is what makes coverage reporting and scheme generation possible."
            action={
              canManage ? (
                <Button data-cy="curriculum-list-new-curriculum-2" onClick={() => setCurriculumDialog({ open: true })}>
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
            const objectiveDensity =
              curriculum.topicCount === 0
                ? 0
                : curriculum.objectiveCount / curriculum.topicCount;
            // The list is already narrowed to what this user teaches or wrote,
            // so anything shown is theirs to maintain. Deleting is stricter:
            // only the author, or a coordinator.
            const isMine = curriculum.createdById === user?.id;
            const canEdit = canManage;
            const canDelete = canManageAcademics || isMine;
            return (
              <Card key={curriculum.id} className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{curriculum.subjectName}</CardTitle>
                    <CardDescription className="truncate">
                      {curriculum.className} · {curriculum.levelName}
                    </CardDescription>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-cy={`curriculum-edit-${curriculum.id}`}
                        aria-label={`Edit ${curriculum.subjectName} for ${curriculum.className}`}
                        onClick={() => setCurriculumDialog({ open: true, curriculum })}
                      >
                        <Pencil />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger hover:text-danger"
                          data-cy={`curriculum-delete-${curriculum.id}`}
                          aria-label={`Delete ${curriculum.subjectName} for ${curriculum.className}`}
                          onClick={() => setPendingDelete(curriculum)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="primary">{curriculum.className}</Badge>
                    <Badge tone={curriculum.sessionId === currentSession?.id ? 'neutral' : 'warning'}>
                      {curriculum.sessionName}
                    </Badge>
                    {isMine && <Badge tone="success">Yours</Badge>}
                  </div>

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

                  <p className="text-xs text-muted-foreground">
                    Written by{' '}
                    <span className="font-medium text-foreground">{curriculum.createdByName}</span>{' '}
                    ({curriculum.createdByRole.toLowerCase()}) on{' '}
                    {formatDate(curriculum.createdAt)}
                  </p>

                  <div className="mt-auto pt-2">
                    <Button data-cy="curriculum-list-open-curriculum" variant="outline" block asChild>
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
        onClose={() => setCurriculumDialog({ open: false })}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this curriculum?"
        description={`"${pendingDelete?.subjectName} · ${pendingDelete?.className}" and all of its topics and objectives will be permanently removed. This cannot be undone if any coverage has been recorded against it.`}
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
