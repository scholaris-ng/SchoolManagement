import { useState } from 'react';
import { CalendarRange, GraduationCap, Layers, Plus, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import {
  useAcademicSessions,
  useClasses,
  useHouses,
  useLevels,
  useSaveClass,
  useSaveHouse,
  useSaveLevel,
  useSaveSubject,
  useSetCurrentTerm,
  useSubjects,
  useTerms,
} from '@/features/academics/api';
import { useTeacherOptions } from '@/features/staff/api';
import type { House, SchoolClass, SchoolLevel, Subject } from '@/types/academics';
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

type Tab = 'sessions' | 'levels' | 'classes' | 'subjects' | 'houses';

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
  const levels = useLevels();
  const classes = useClasses({ includeInactive: true });
  const subjects = useSubjects();
  const houses = useHouses();

  const setCurrentTerm = useSetCurrentTerm();

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
    { id: 'levels', label: 'Levels', icon: Layers },
    { id: 'classes', label: 'Classes', icon: Users },
    { id: 'subjects', label: 'Subjects', icon: GraduationCap },
    { id: 'houses', label: 'Houses', icon: Trophy },
  ];

  const newAction = {
    sessions: null,
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
            <Button onClick={newAction}>
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
                              {term.isCurrent ? (
                                <Badge tone="primary">Current</Badge>
                              ) : (
                                <Button
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
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDate(term.startDate)} – {formatDate(term.endDate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {term.teachingWeeks} teaching weeks
                            </p>
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
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
              Each class belongs to a level and has a form teacher who takes its register.
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
                        {schoolClass.levelName} · {schoolClass.formTeacherName ?? 'No form teacher'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {schoolClass.enrolledCount} / {schoolClass.capacity}
                    </span>
                    {!schoolClass.isActive && <Badge tone="warning">Inactive</Badge>}
                    <Button
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
                      </p>
                    </div>
                    {subject.isCore && <Badge tone="primary">Core</Badge>}
                    {!subject.isActive && <Badge tone="warning">Inactive</Badge>}
                    <Button
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
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
  const [formTeacherId, setFormTeacherId] = useState(state.schoolClass?.formTeacherId ?? '');

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
              id="class-arm"
              value={arm}
              onChange={(event) => setArm(event.target.value)}
              placeholder="e.g. Gold"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-capacity">Capacity</Label>
            <Input
              id="class-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-teacher">Form teacher</Label>
            <NativeSelect
              id="class-teacher"
              value={formTeacherId}
              onChange={(event) => setFormTeacherId(event.target.value)}
            >
              <option value="">Not assigned</option>
              {teachers.map((teacher) => (
                <option key={teacher.value} value={teacher.value}>
                  {teacher.label}
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
                    formTeacherId: formTeacherId || null,
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
  onClose,
}: {
  state: { open: boolean; subject?: Subject };
  levels: SchoolLevel[];
  onClose: () => void;
}) {
  const save = useSaveSubject();
  const [name, setName] = useState(state.subject?.name ?? '');
  const [code, setCode] = useState(state.subject?.code ?? '');
  const [category, setCategory] = useState(state.subject?.category ?? '');
  const [isCore, setIsCore] = useState(state.subject?.isCore ?? true);
  const [levelIds, setLevelIds] = useState<string[]>(state.subject?.levelIds ?? []);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
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
                id="subject-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-category">Category</Label>
              <Input
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
              type="checkbox"
              checked={isCore}
              onChange={(event) => setIsCore(event.target.checked)}
              className="size-4 rounded border-input"
            />
            Core subject — every student at these levels takes it
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
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
                id="house-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded border border-input"
              />
              <Input value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="house-motto">Motto</Label>
            <Input
              id="house-motto"
              value={motto}
              onChange={(event) => setMotto(event.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
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
