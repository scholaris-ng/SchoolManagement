import { useState } from 'react';
import {
  CalendarRange,
  Clock,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatTime } from '@/lib/format';
import { WEEKDAYS, teachingWeeksBetween } from '@/lib/weekdays';
import {
  useAcademicSessions,
  useClasses,
  useDeletePeriod,
  useDeleteSession,
  useHouses,
  useLevels,
  usePeriods,
  useSaveClass,
  useSaveHouse,
  useSaveLevel,
  useSavePeriod,
  useSaveSession,
  useSaveSubject,
  useSaveTerm,
  useSetCurrentTerm,
  useSubjects,
  useTerms,
} from '@/features/academics/api';
import { useTeacherOptions } from '@/features/staff/api';
import type { AcademicSession, House, SchoolClass, SchoolLevel, Subject, Term } from '@/types/academics';
import type { TimetablePeriod, Weekday } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
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
import { StatusBadge } from '@/components/data/status-badge';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import { SettingsTabs } from './settings-tabs';

type Tab = 'sessions' | 'periods' | 'levels' | 'classes' | 'subjects' | 'houses';

/**
 * The academic structure, defined by the school rather than the software.
 *
 * Nothing here assumes Nursery/Primary/JSS/SSS. A school entering Reception
 * through Year 11, or Creche through SS3, gets the same screens and the same
 * behaviour everywhere else in the product (spec section 6).
 */
export function AcademicsSettingsPage() {
  const [tab, setTab] = useState<Tab>('sessions');

  const sessions = useAcademicSessions();
  const terms = useTerms();
  const periods = usePeriods();
  const levels = useLevels();
  const classes = useClasses({ includeInactive: true });
  const subjects = useSubjects();
  const houses = useHouses();

  const setCurrentTerm = useSetCurrentTerm();
  const deleteSession = useDeleteSession();
  const deletePeriod = useDeletePeriod();

  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; session?: AcademicSession }>({
    open: false,
  });
  const [termDialog, setTermDialog] = useState<{
    open: boolean;
    term?: Term;
    sessionId?: string;
    sessionName?: string;
  }>({ open: false });
  const [periodDialog, setPeriodDialog] = useState<{ open: boolean; period?: TimetablePeriod }>({
    open: false,
  });
  const [pendingDeleteSession, setPendingDeleteSession] = useState<AcademicSession | null>(null);
  const [pendingDeletePeriod, setPendingDeletePeriod] = useState<TimetablePeriod | null>(null);
  const [levelDialog, setLevelDialog] = useState<{ open: boolean; level?: SchoolLevel }>({
    open: false,
  });
  const [classDialog, setClassDialog] = useState<{ open: boolean; schoolClass?: SchoolClass }>({
    open: false,
  });
  const [subjectDialog, setSubjectDialog] = useState<{ open: boolean; subject?: Subject }>({
    open: false,
  });
  const [houseDialog, setHouseDialog] = useState<{ open: boolean; house?: House }>({ open: false });

  const tabs: { id: Tab; label: string; icon: typeof Layers }[] = [
    { id: 'sessions', label: 'Sessions & terms', icon: CalendarRange },
    { id: 'periods', label: 'Periods', icon: Clock },
    { id: 'levels', label: 'Levels', icon: Layers },
    { id: 'classes', label: 'Classes', icon: Users },
    { id: 'subjects', label: 'Subjects', icon: GraduationCap },
    { id: 'houses', label: 'Houses', icon: Trophy },
  ];

  const newAction = {
    sessions: () => setSessionDialog({ open: true }),
    periods: () => setPeriodDialog({ open: true }),
    levels: () => setLevelDialog({ open: true }),
    classes: () => setClassDialog({ open: true }),
    subjects: () => setSubjectDialog({ open: true }),
    houses: () => setHouseDialog({ open: true }),
  }[tab];

  return (
    <PageContainer>
      <PageHeader
        title="Academic setup"
        description="Sessions, terms, levels, classes, subjects and houses — all defined by your school."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Academic setup' }]}
        actions={
          newAction && (
            <Button data-cy="settings-academics-settings-new" onClick={newAction}>
              <Plus />
              New {tab.slice(0, -1)}
            </Button>
          )
        }
      />

      <SettingsTabs />

      <div role="tablist" aria-label="Academic structure" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            data-cy={`academics-settings-tab-${option.id}`}
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
              tab === option.id
                ? 'text-primary after:bg-primary'
                : 'text-muted-foreground after:bg-transparent hover:text-foreground',
            )}
          >
            <option.icon className="size-4" aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'sessions' && (
        <Card>
          <CardHeader>
            <CardTitle>Academic sessions and terms</CardTitle>
            <CardDescription>
              The current term drives attendance, score entry, invoicing and report cards. Only one
              term can be current at a time.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {sessions.isPending ? (
              <LoadingState label="Loading sessions…" />
            ) : (sessions.data?.length ?? 0) === 0 ? (
              <EmptyState compact icon={<CalendarRange />} title="No sessions defined" />
            ) : (
              <ul className="divide-y divide-border">
                {sessions.data?.map((session) => (
                  <li key={session.id} className="space-y-2 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{session.name}</p>
                      {session.isCurrent && <Badge tone="success">Current session</Badge>}
                      <StatusBadge status={session.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(session.startDate)} – {formatDate(session.endDate)}
                      </span>
                      <Button
                        data-cy="settings-academics-settings-edit"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 px-2 text-xs"
                        onClick={() => setSessionDialog({ open: true, session })}
                      >
                        Edit
                      </Button>
                      <Button
                        data-cy="settings-academics-settings-delete"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-danger hover:text-danger"
                        disabled={session.isCurrent}
                        title={
                          session.isCurrent
                            ? 'Make another session current before deleting this one'
                            : undefined
                        }
                        onClick={() => setPendingDeleteSession(session)}
                      >
                        Delete
                      </Button>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-3">
                      {(terms.data ?? [])
                        .filter((term) => term.sessionId === session.id)
                        .map((term) => (
                          <li
                            key={term.id}
                            className={cn(
                              'rounded-md border p-3 text-sm',
                              term.isCurrent ? 'border-primary bg-primary-subtle' : 'border-border',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium">{term.name}</p>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  data-cy={`academics-settings-term-edit-${term.id}`}
                                  aria-label={`Edit ${term.name}`}
                                  onClick={() =>
                                    setTermDialog({ open: true, term, sessionId: session.id })
                                  }
                                  className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                  <Pencil className="size-3.5" aria-hidden="true" />
                                </button>
                                {term.isCurrent ? (
                                  <Badge tone="primary">Current</Badge>
                                ) : (
                                  <Button
                                    data-cy="settings-academics-settings-make-current"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    loading={
                                      setCurrentTerm.isPending && setCurrentTerm.variables === term.id
                                    }
                                    onClick={() => setCurrentTerm.mutate(term.id)}
                                  >
                                    Make current
                                  </Button>
                                )}
                              </div>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDate(term.startDate)} – {formatDate(term.endDate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {term.teachingWeeks} teaching weeks
                            </p>
                          </li>
                        ))}
                      <li>
                        <button
                          data-cy="settings-academics-settings-add-term"
                          type="button"
                          onClick={() =>
                            setTermDialog({
                              open: true,
                              sessionId: session.id,
                              sessionName: session.name,
                            })
                          }
                          className="grid h-full min-h-[4.5rem] w-full place-items-center rounded-md border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40"
                        >
                          + Add term
                        </button>
                      </li>
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'periods' && (
        <Card>
          <CardHeader>
            <CardTitle>The school day</CardTitle>
            <CardDescription>
              Period names and times, in order. This is the grid the timetable is built on — a class
              or teacher can only be scheduled into a period defined here.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {periods.isPending ? (
              <LoadingState label="Loading periods…" />
            ) : (periods.data?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<Clock />}
                title="No periods defined"
                description="Add the first period below — the timetable has nowhere to place a lesson until the school day is laid out."
              />
            ) : (
              <ol className="divide-y divide-border">
                {periods.data?.map((period) => (
                  <li key={period.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                      {period.sequence}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{period.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatTime(period.startTime)} – {formatTime(period.endTime)}
                      </p>
                    </div>
                    {period.isBreak && <Badge tone="warning">Break</Badge>}
                    <Button
                      data-cy="settings-academics-settings-edit-2"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPeriodDialog({ open: true, period })}
                    >
                      Edit
                    </Button>
                    <Button
                      data-cy="settings-academics-settings-delete-2"
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger"
                      onClick={() => setPendingDeletePeriod(period)}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'levels' && (
        <Card>
          <CardHeader>
            <CardTitle>School levels</CardTitle>
            <CardDescription>
              Your own ladder — Creche to SS3, Reception to Year 11, or whatever your school uses.
              Order decides how promotion works.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {levels.isPending ? (
              <LoadingState label="Loading levels…" />
            ) : (levels.data?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<Layers />}
                title="No levels defined"
                description="Start here — classes, subjects and grading all hang off levels."
              />
            ) : (
              <ol className="divide-y divide-border">
                {levels.data?.map((level) => (
                  <li key={level.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                      {level.sequence}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{level.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {level.code} · {level.classCount}{' '}
                        {level.classCount === 1 ? 'class' : 'classes'}
                        {level.gradingSchemeName ? ` · ${level.gradingSchemeName}` : ''}
                      </p>
                    </div>
                    <Button
                      data-cy="settings-academics-settings-edit-3"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLevelDialog({ open: true, level })}
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'classes' && (
        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
            <CardDescription>
              Each class belongs to a level and has form teachers who take its register.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {classes.isPending ? (
              <LoadingState label="Loading classes…" />
            ) : (classes.data?.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Users />} title="No classes defined" />
            ) : (
              <ul className="divide-y divide-border">
                {classes.data?.map((schoolClass) => (
                  <li key={schoolClass.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{schoolClass.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {schoolClass.levelName} ·{' '}
                        {schoolClass.formTeacherNames.length > 0
                          ? schoolClass.formTeacherNames.join(', ')
                          : 'No form teacher'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {schoolClass.enrolledCount} / {schoolClass.capacity}
                    </span>
                    {!schoolClass.isActive && <Badge tone="warning">Inactive</Badge>}
                    <Button
                      data-cy="settings-academics-settings-edit-4"
                      variant="ghost"
                      size="sm"
                      onClick={() => setClassDialog({ open: true, schoolClass })}
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'subjects' && (
        <Card>
          <CardHeader>
            <CardTitle>Subjects</CardTitle>
            <CardDescription>
              Which levels take each subject decides where it appears on report cards.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {subjects.isPending ? (
              <LoadingState label="Loading subjects…" />
            ) : (subjects.data?.length ?? 0) === 0 ? (
              <EmptyState compact icon={<GraduationCap />} title="No subjects defined" />
            ) : (
              <ul className="divide-y divide-border">
                {subjects.data?.map((subject) => (
                  <li key={subject.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {subject.name}
                        <span className="font-normal text-muted-foreground"> · {subject.code}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {subject.levelNames.join(', ') || 'No levels assigned'}
                        {subject.schedule.length > 0 &&
                          ` · ${subject.schedule.length} period${subject.schedule.length === 1 ? '' : 's'}/week`}
                      </p>
                    </div>
                    {subject.isCore && <Badge tone="primary">Core</Badge>}
                    {!subject.isActive && <Badge tone="warning">Inactive</Badge>}
                    <Button
                      data-cy="settings-academics-settings-edit-5"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSubjectDialog({ open: true, subject })}
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'houses' && (
        <Card>
          <CardHeader>
            <CardTitle>Houses</CardTitle>
            <CardDescription>House points and leaderboards are built from these.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {houses.isPending ? (
              <LoadingState label="Loading houses…" />
            ) : (houses.data?.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Trophy />} title="No houses defined" />
            ) : (
              <ul className="divide-y divide-border">
                {houses.data?.map((house) => (
                  <li key={house.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span
                      className="size-4 shrink-0 rounded-full"
                      style={{ backgroundColor: house.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{house.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {house.memberCount} students · {house.points} points
                        {house.captainName ? ` · captain ${house.captainName}` : ''}
                      </p>
                    </div>
                    <Button
                      data-cy="settings-academics-settings-edit-6"
                      variant="ghost"
                      size="sm"
                      onClick={() => setHouseDialog({ open: true, house })}
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <SessionDialog
        key={sessionDialog.session?.id ?? 'new-session'}
        state={sessionDialog}
        onClose={() => setSessionDialog({ open: false })}
      />
      <TermDialog
        key={termDialog.term?.id ?? `new-term-${termDialog.sessionId ?? ''}`}
        state={termDialog}
        onClose={() => setTermDialog({ open: false })}
      />
      <PeriodDialog
        key={periodDialog.period?.id ?? 'new-period'}
        state={periodDialog}
        nextSequence={(periods.data?.length ?? 0) + 1}
        onClose={() => setPeriodDialog({ open: false })}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteSession)}
        onOpenChange={(open) => !open && setPendingDeleteSession(null)}
        title="Delete this academic session?"
        description={`"${pendingDeleteSession?.name}" and its ${pendingDeleteSession?.termCount ?? 0} term(s) will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteSession.isPending}
        onConfirm={async () => {
          if (pendingDeleteSession) await deleteSession.mutateAsync(pendingDeleteSession.id);
          setPendingDeleteSession(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDeletePeriod)}
        onOpenChange={(open) => !open && setPendingDeletePeriod(null)}
        title="Delete this period?"
        description={`"${pendingDeletePeriod?.name}" will be removed from the school day and from the timetable grid.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deletePeriod.isPending}
        onConfirm={async () => {
          if (pendingDeletePeriod) await deletePeriod.mutateAsync(pendingDeletePeriod.id);
          setPendingDeletePeriod(null);
        }}
      />

      <LevelDialog
        key={levelDialog.level?.id ?? 'new-level'}
        state={levelDialog}
        nextSequence={(levels.data?.length ?? 0) + 1}
        onClose={() => setLevelDialog({ open: false })}
      />
      <ClassDialog
        key={classDialog.schoolClass?.id ?? 'new-class'}
        state={classDialog}
        levels={(levels.data ?? []).map((level) => ({ value: level.id, label: level.name }))}
        onClose={() => setClassDialog({ open: false })}
      />
      <SubjectDialog
        key={subjectDialog.subject?.id ?? 'new-subject'}
        state={subjectDialog}
        levels={levels.data ?? []}
        periods={periods.data ?? []}
        onClose={() => setSubjectDialog({ open: false })}
      />
      <HouseDialog
        key={houseDialog.house?.id ?? 'new-house'}
        state={houseDialog}
        onClose={() => setHouseDialog({ open: false })}
      />
    </PageContainer>
  );
}

/** Teaching weeks are not held here — they are read off the dates on save. */
interface TermRow {
  name: string;
  startDate: string;
  endDate: string;
}

function SessionDialog({
  state,
  onClose,
}: {
  state: { open: boolean; session?: AcademicSession };
  onClose: () => void;
}) {
  const save = useSaveSession();
  const isNew = !state.session;
  const [name, setName] = useState(state.session?.name ?? '');
  const [startDate, setStartDate] = useState(state.session?.startDate ?? '');
  const [endDate, setEndDate] = useState(state.session?.endDate ?? '');
  const [termRows, setTermRows] = useState<TermRow[]>(
    isNew
      ? [
          { name: 'First Term', startDate: '', endDate: '' },
          { name: 'Second Term', startDate: '', endDate: '' },
          { name: 'Third Term', startDate: '', endDate: '' },
        ]
      : [],
  );

  const updateTerm = (index: number, patch: Partial<TermRow>) => {
    setTermRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  // A backwards range would derive no teaching weeks at all, so it is caught
  // here rather than saved and puzzled over later.
  const termsValid = termRows.every(
    (row) => row.name.trim() && row.startDate && row.endDate && row.endDate >= row.startDate,
  );
  const valid =
    Boolean(name.trim() && startDate && endDate) && endDate >= startDate && termsValid;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New academic session' : 'Edit academic session'}</DialogTitle>
          {isNew && (
            <DialogDescription>
              Every session here runs on three terms. Set the session&apos;s own dates, then each
              term&apos;s — nothing is guessed for you, but every date can be changed later.
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="session-name" required>
                Name
              </Label>
              <Input
                data-cy="session-name"
                id="session-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. 2027/2028"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-start" required>
                Starts
              </Label>
              <Input
                data-cy="session-start"
                id="session-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-end" required>
                Ends
              </Label>
              <Input
                data-cy="session-end"
                id="session-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          {isNew && (
            <div className="space-y-3">
              <Label>Terms</Label>
              {termRows.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`term-name-${index}`} required>
                      Name
                    </Label>
                    <Input
                      data-cy="academics-settings-name"
                      id={`term-name-${index}`}
                      value={row.name}
                      onChange={(event) => updateTerm(index, { name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`term-start-${index}`} required>
                      Starts
                    </Label>
                    <Input
                      data-cy="academics-settings-start-date"
                      id={`term-start-${index}`}
                      type="date"
                      value={row.startDate}
                      onChange={(event) => updateTerm(index, { startDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`term-end-${index}`} required>
                      Ends
                    </Label>
                    <Input
                      data-cy="academics-settings-end-date"
                      id={`term-end-${index}`}
                      type="date"
                      min={row.startDate}
                      value={row.endDate}
                      onChange={(event) => updateTerm(index, { endDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`term-weeks-${index}`}>Teaching weeks</Label>
                    <Input
                      data-cy="academics-settings-end-date-2"
                      id={`term-weeks-${index}`}
                      value={teachingWeeksBetween(row.startDate, row.endDate) || '—'}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.session?.id,
                  values: {
                    name: name.trim(),
                    startDate,
                    endDate,
                    ...(isNew
                      ? {
                          terms: termRows.map((row) => ({
                            name: row.name.trim(),
                            startDate: row.startDate,
                            endDate: row.endDate,
                            teachingWeeks: teachingWeeksBetween(row.startDate, row.endDate),
                          })),
                        }
                      : {}),
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

function TermDialog({
  state,
  onClose,
}: {
  state: { open: boolean; term?: Term; sessionId?: string; sessionName?: string };
  onClose: () => void;
}) {
  const save = useSaveTerm();
  const [name, setName] = useState(state.term?.name ?? '');
  const [startDate, setStartDate] = useState(state.term?.startDate ?? '');
  const [endDate, setEndDate] = useState(state.term?.endDate ?? '');

  // Read off the dates rather than typed in: a term whose dates move and whose
  // week count does not is how a scheme of work ends up planned against weeks
  // the term does not have.
  const teachingWeeks = teachingWeeksBetween(startDate, endDate);
  const datesOutOfOrder = Boolean(startDate && endDate && endDate < startDate);

  const valid = Boolean(name.trim() && startDate && endDate && !datesOutOfOrder);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.term ? 'Edit term' : 'New term'}</DialogTitle>
          <DialogDescription>{state.term?.sessionName ?? state.sessionName}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="term-name" required>
              Name
            </Label>
            <Input
              data-cy="term-name"
              id="term-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. First Term"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="term-start" required>
                Starts
              </Label>
              <Input
                data-cy="term-start"
                id="term-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term-end" required>
                Ends
              </Label>
              <Input
                data-cy="term-end"
                id="term-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-weeks">Teaching weeks</Label>
            <Input data-cy="term-weeks" id="term-weeks" value={teachingWeeks || '—'} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              {datesOutOfOrder
                ? 'The end date is before the start date.'
                : teachingWeeks
                  ? 'Counted from the dates above, Mondays to Fridays. Schemes of work are spread across these weeks.'
                  : 'Set the start and end dates and this is worked out for you.'}
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-2" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-2"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.term?.id,
                  values: {
                    name: name.trim(),
                    startDate,
                    endDate,
                    teachingWeeks,
                    ...(state.term ? {} : { sessionId: state.sessionId }),
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

function PeriodDialog({
  state,
  nextSequence,
  onClose,
}: {
  state: { open: boolean; period?: TimetablePeriod };
  nextSequence: number;
  onClose: () => void;
}) {
  const save = useSavePeriod();
  const [name, setName] = useState(state.period?.name ?? '');
  const [startTime, setStartTime] = useState(state.period?.startTime ?? '');
  const [endTime, setEndTime] = useState(state.period?.endTime ?? '');
  const [sequence, setSequence] = useState(String(state.period?.sequence ?? nextSequence));
  const [isBreak, setIsBreak] = useState(state.period?.isBreak ?? false);

  const valid = Boolean(name.trim() && startTime && endTime);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.period ? 'Edit period' : 'New period'}</DialogTitle>
          <DialogDescription>
            Sequence sets where this sits in the school day, top to bottom on the timetable.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="period-name" required>
              Name
            </Label>
            <Input
              data-cy="period-name"
              id="period-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Period 1, or Break"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period-start" required>
                Starts
              </Label>
              <Input
                data-cy="period-start"
                id="period-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end" required>
                Ends
              </Label>
              <Input
                data-cy="period-end"
                id="period-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="period-sequence" required>
              Sequence
            </Label>
            <Input
              data-cy="period-sequence"
              id="period-sequence"
              type="number"
              min={1}
              value={sequence}
              onChange={(event) => setSequence(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              data-cy="academics-settings-is-break"
              type="checkbox"
              checked={isBreak}
              onChange={(event) => setIsBreak(event.target.checked)}
              className="size-4 rounded border-input"
            />
            This is a break, not a teaching period
          </label>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-3" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-3"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.period?.id,
                  values: {
                    name: name.trim(),
                    startTime,
                    endTime,
                    sequence: Number(sequence),
                    isBreak,
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

function LevelDialog({
  state,
  nextSequence,
  onClose,
}: {
  state: { open: boolean; level?: SchoolLevel };
  nextSequence: number;
  onClose: () => void;
}) {
  const save = useSaveLevel();
  const [name, setName] = useState(state.level?.name ?? '');
  const [code, setCode] = useState(state.level?.code ?? '');
  const [sequence, setSequence] = useState(String(state.level?.sequence ?? nextSequence));

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.level ? 'Edit level' : 'New level'}</DialogTitle>
          <DialogDescription>
            Sequence sets the order children are promoted through.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="level-name" required>
              Name
            </Label>
            <Input
              data-cy="level-name"
              id="level-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Year 7, or JSS 1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="level-code">Code</Label>
              <Input
                data-cy="level-code"
                id="level-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="level-sequence" required>
                Sequence
              </Label>
              <Input
                data-cy="level-sequence"
                id="level-sequence"
                type="number"
                min={1}
                value={sequence}
                onChange={(event) => setSequence(event.target.value)}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-4" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-4"
            loading={save.isPending}
            disabled={!name.trim()}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.level?.id,
                  values: {
                    name: name.trim(),
                    code: code.trim() || name.trim().toUpperCase().replace(/\s+/g, ''),
                    sequence: Number(sequence),
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

function ClassDialog({
  state,
  levels,
  onClose,
}: {
  state: { open: boolean; schoolClass?: SchoolClass };
  levels: { value: string; label: string }[];
  onClose: () => void;
}) {
  const save = useSaveClass();
  const teachers = useTeacherOptions();
  const [name, setName] = useState(state.schoolClass?.name ?? '');
  const [levelId, setLevelId] = useState(state.schoolClass?.levelId ?? levels[0]?.value ?? '');
  const [arm, setArm] = useState(state.schoolClass?.arm ?? '');
  const [capacity, setCapacity] = useState(String(state.schoolClass?.capacity ?? 40));
  const [formTeacherIds, setFormTeacherIds] = useState<string[]>(
    state.schoolClass?.formTeacherIds ?? [],
  );

  const toggleTeacher = (teacherId: string) =>
    setFormTeacherIds((current) =>
      current.includes(teacherId)
        ? current.filter((id) => id !== teacherId)
        : [...current, teacherId],
    );

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.schoolClass ? 'Edit class' : 'New class'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="class-name" required>
              Class name
            </Label>
            <Input
              data-cy="class-name"
              id="class-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. JSS 1 Gold"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-level" required>
              Level
            </Label>
            <NativeSelect
              data-cy="class-level"
              id="class-level"
              value={levelId}
              onChange={(event) => setLevelId(event.target.value)}
            >
              {levels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-arm">Arm</Label>
            <Input
              data-cy="class-arm"
              id="class-arm"
              value={arm}
              onChange={(event) => setArm(event.target.value)}
              placeholder="e.g. Gold"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-capacity">Capacity</Label>
            <Input
              data-cy="class-capacity"
              id="class-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
          </div>
          <fieldset className="space-y-1.5 sm:col-span-2">
            <legend className="text-sm font-medium">Form teachers</legend>
            {teachers.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                No teachers to assign yet.
              </p>
            ) : (
              <div className="scrollbar-thin grid max-h-40 gap-2 overflow-y-auto rounded-md border border-input p-3 sm:grid-cols-2">
                {teachers.map((teacher) => (
                  <label key={teacher.value} className="flex items-center gap-2 text-sm">
                    <input
                      data-cy="academics-settings-value"
                      type="checkbox"
                      checked={formTeacherIds.includes(teacher.value)}
                      onChange={() => toggleTeacher(teacher.value)}
                      className="size-4 rounded border-input"
                    />
                    {teacher.label}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-5" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-5"
            loading={save.isPending}
            disabled={!name.trim() || !levelId}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.schoolClass?.id,
                  values: {
                    name: name.trim(),
                    levelId,
                    arm: arm.trim() || null,
                    capacity: Number(capacity),
                    formTeacherIds,
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

function SubjectDialog({
  state,
  levels,
  periods,
  onClose,
}: {
  state: { open: boolean; subject?: Subject };
  levels: SchoolLevel[];
  periods: TimetablePeriod[];
  onClose: () => void;
}) {
  const save = useSaveSubject();
  const [name, setName] = useState(state.subject?.name ?? '');
  const [code, setCode] = useState(state.subject?.code ?? '');
  const [category, setCategory] = useState(state.subject?.category ?? '');
  const [isCore, setIsCore] = useState(state.subject?.isCore ?? true);
  const [levelIds, setLevelIds] = useState<string[]>(state.subject?.levelIds ?? []);
  const [schedule, setSchedule] = useState<Set<string>>(
    () => new Set((state.subject?.schedule ?? []).map((slot) => `${slot.day}:${slot.periodId}`)),
  );

  const toggleSlot = (day: Weekday, periodId: string) => {
    const key = `${day}:${periodId}`;
    setSchedule((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const teachingPeriods = periods.filter((period) => !period.isBreak);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{state.subject ? 'Edit subject' : 'New subject'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="subject-name" required>
                Name
              </Label>
              <Input
                data-cy="subject-name"
                id="subject-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-code" required>
                Code
              </Label>
              <Input
                data-cy="subject-code"
                id="subject-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-category">Category</Label>
              <Input
                data-cy="subject-category"
                id="subject-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. Sciences"
              />
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Taught at</legend>
            <div className="scrollbar-thin grid max-h-40 gap-2 overflow-y-auto rounded-md border border-input p-3 sm:grid-cols-2">
              {levels.map((level) => (
                <label key={level.id} className="flex items-center gap-2 text-sm">
                  <input
                    data-cy="academics-settings-id"
                    type="checkbox"
                    checked={levelIds.includes(level.id)}
                    onChange={() =>
                      setLevelIds((current) =>
                        current.includes(level.id)
                          ? current.filter((entry) => entry !== level.id)
                          : [...current, level.id],
                      )
                    }
                    className="size-4 rounded border-input"
                  />
                  {level.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              data-cy="academics-settings-is-core"
              type="checkbox"
              checked={isCore}
              onChange={(event) => setIsCore(event.target.checked)}
              className="size-4 rounded border-input"
            />
            Core subject — every student at these levels takes it
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Weekly periods</legend>
            <p className="text-xs text-muted-foreground">
              Optional — mark which periods this subject is normally taught in.
            </p>
            {teachingPeriods.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No periods are set up yet — add them under the Periods tab first.
              </p>
            ) : (
              <div className="scrollbar-thin max-h-56 overflow-auto rounded-md border border-input">
                <table className="w-full min-w-[28rem] text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="sticky left-0 bg-muted/40 px-2 py-1.5 text-left font-medium">
                        Period
                      </th>
                      {WEEKDAYS.map((day) => (
                        <th key={day.value} className="px-2 py-1.5 text-center font-medium">
                          {day.short}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teachingPeriods.map((period) => (
                      <tr key={period.id}>
                        <td className="sticky left-0 bg-card px-2 py-1.5 font-medium">
                          {period.name}
                        </td>
                        {WEEKDAYS.map((day) => (
                          <td key={day.value} className="px-2 py-1.5 text-center">
                            <input
                              data-cy="academics-settings-id-2"
                              type="checkbox"
                              aria-label={`${period.name} on ${day.label}`}
                              checked={schedule.has(`${day.value}:${period.id}`)}
                              onChange={() => toggleSlot(day.value, period.id)}
                              className="size-4 rounded border-input"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-6" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-6"
            loading={save.isPending}
            disabled={!name.trim() || !code.trim()}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.subject?.id,
                  values: {
                    name: name.trim(),
                    code: code.trim(),
                    category: category.trim() || null,
                    isCore,
                    levelIds,
                    schedule: Array.from(schedule).map((key) => {
                      const [day, periodId] = key.split(':') as [Weekday, string];
                      return { day, periodId };
                    }),
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

function HouseDialog({
  state,
  onClose,
}: {
  state: { open: boolean; house?: House };
  onClose: () => void;
}) {
  const save = useSaveHouse();
  const [name, setName] = useState(state.house?.name ?? '');
  const [color, setColor] = useState(state.house?.color ?? '#2563eb');
  const [motto, setMotto] = useState(state.house?.motto ?? '');

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.house ? 'Edit house' : 'New house'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="house-name" required>
              Name
            </Label>
            <Input
              data-cy="house-name"
              id="house-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Blue House"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="house-color">Colour</Label>
            <div className="flex items-center gap-2">
              <input
                data-cy="house-color"
                id="house-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded border border-input"
              />
              <Input data-cy="academics-settings-color" value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="house-motto">Motto</Label>
            <Input
              data-cy="house-motto"
              id="house-motto"
              value={motto}
              onChange={(event) => setMotto(event.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="settings-academics-settings-cancel-7" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="settings-academics-settings-save-7"
            loading={save.isPending}
            disabled={!name.trim()}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.house?.id,
                  values: { name: name.trim(), color, motto: motto.trim() || null },
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
