import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlarmClock, Plus, Printer, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/format';
import { isApiError } from '@/lib/api-error';
import { toast } from '@/lib/toast-bus';
import { WEEKDAYS as DAYS } from '@/lib/weekdays';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses, useRooms, useSubjects } from '@/features/academics/api';
import { useTeacherOptions } from '@/features/staff/api';
import {
  useClearTimetable,
  useCurrentTimetable,
  useDeleteTimetableEntry,
  useSaveTimetableEntry,
} from './api';
import type { TimetableEntry, Weekday } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
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
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';

interface SlotTarget {
  day: Weekday;
  periodId: string;
  entry?: TimetableEntry;
}

/**
 * The timetable grid.
 *
 * Periods down the side, days across the top — the shape every school already
 * draws on paper. Clicking an empty cell places a lesson; the server refuses
 * anything that would double-book a teacher, a class or a room.
 */
export function TimetablePage() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const classId = searchParams.get('classId') ?? '';
  const teacherId = searchParams.get('teacherId') ?? '';
  const subjectId = searchParams.get('subjectId') ?? '';

  const timetable = useCurrentTimetable({
    classId: classId || undefined,
    teacherId: teacherId || undefined,
    subjectId: subjectId || undefined,
  });
  const classes = useClasses();
  const subjects = useSubjects();
  const rooms = useRooms();
  const teachers = useTeacherOptions();

  const saveEntry = useSaveTimetableEntry(timetable.data?.id ?? '');
  const deleteEntry = useDeleteTimetableEntry(timetable.data?.id ?? '');
  const clearTimetable = useClearTimetable(timetable.data?.id ?? '');

  const [slot, setSlot] = useState<SlotTarget | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  /**
   * Updates one or more filters in a single history entry.
   *
   * `useSearchParams`'s setter closes over the params from the render that
   * created it, so two separate calls in the same handler race: the second
   * overwrites the first using params from before either call, silently
   * discarding the change the first call made. Every filter change goes
   * through here as one call so that never happens.
   */
  const setParams = (patch: Record<string, string>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const entriesBySlot = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();
    (timetable.data?.entries ?? []).forEach((entry) => {
      const key = `${entry.day}:${entry.periodId}`;
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    return map;
  }, [timetable.data]);

  const canManage = can('timetable.manage');

  /**
   * Dragging a lesson onto an empty cell moves it: same entry id, new
   * day/period. The server re-runs clash detection exactly as it would for a
   * fresh placement, so a drop that would double-book someone is refused with
   * the same message a manual edit would get.
   */
  const moveEntry = async (entry: TimetableEntry, day: Weekday, periodId: string) => {
    if (entry.day === day && entry.periodId === periodId) return;
    try {
      await saveEntry.mutateAsync({
        entryId: entry.id,
        classId: entry.classId,
        subjectId: entry.subjectId,
        teacherId: entry.teacherId,
        roomId: entry.roomId,
        periodId,
        day,
      });
    } catch (error) {
      toast.error('That move would clash', {
        description: isApiError(error) ? error.message : 'That lesson could not be moved.',
      });
    }
  };

  /** Dragging a lesson onto the trash zone deletes it, same as the dialog's Remove button. */
  const removeEntry = async (entry: TimetableEntry) => {
    try {
      await deleteEntry.mutateAsync(entry.id);
    } catch (error) {
      toast.error('Could not remove that lesson', {
        description: isApiError(error) ? error.message : 'Try again in a moment.',
      });
    }
  };

  if (timetable.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Loading the timetable…" />
      </PageContainer>
    );
  }

  if (timetable.isError) {
    return (
      <PageContainer>
        <ErrorState
          error={timetable.error}
          onRetry={() => void timetable.refetch()}
          title="No timetable for this term yet"
        />
      </PageContainer>
    );
  }

  const periods = timetable.data?.periods ?? [];

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Timetable"
        description={
          canManage
            ? 'Who teaches what, where and when. Drag a lesson onto an empty period to move it — clashes are refused rather than warned about.'
            : 'Who teaches what, where and when. Clashes are refused rather than warned about.'
        }
        breadcrumbs={[{ label: 'Teaching' }, { label: 'Timetable' }]}
        actions={
          <>
            {canManage && (
              <Button
                variant="outline"
                className="text-danger hover:text-danger"
                disabled={(timetable.data?.entries.length ?? 0) === 0}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 />
                Clear timetable
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
          </>
        }
      />

      <Card className="no-print">
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="space-y-1.5">
            <Label htmlFor="tt-class">Class</Label>
            <NativeSelect
              id="tt-class"
              value={classId}
              onChange={(event) => {
                const value = event.target.value;
                setParams(value ? { classId: value, teacherId: '' } : { classId: '' });
              }}
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

          {/* Nothing to choose between unless this user may read the roster. */}
          {teachers.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="tt-teacher">Teacher</Label>
              <NativeSelect
                id="tt-teacher"
                value={teacherId}
                onChange={(event) => {
                  const value = event.target.value;
                  setParams(value ? { teacherId: value, classId: '' } : { teacherId: '' });
                }}
                className="w-auto"
              >
                <option value="">All teachers</option>
                {teachers.map((teacher) => (
                  <option key={teacher.value} value={teacher.value}>
                    {teacher.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tt-subject">Subject</Label>
            <NativeSelect
              id="tt-subject"
              value={subjectId}
              onChange={(event) => setParams({ subjectId: event.target.value })}
              className="w-auto"
            >
              <option value="">All subjects</option>
              {(subjects.data ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <p className="ml-auto text-sm text-muted-foreground">
            {timetable.data?.name} · {timetable.data?.termName}
          </p>
        </CardContent>
      </Card>

      {periods.length === 0 ? (
        <Card>
          <EmptyState
            icon={<AlarmClock />}
            title="No periods defined"
            description="Set up the school day — period names and times — under Academic setup before building a timetable."
          />
        </Card>
      ) : (
        <Card className="print-page">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">
                Weekly timetable: periods down the side, days across the top
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-32 bg-muted/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Period
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day.value}
                      scope="col"
                      className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <span className="hidden sm:inline">{day.label}</span>
                      <span className="sm:hidden">{day.short}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {periods.map((period) => (
                  <tr key={period.id} className={cn(period.isBreak && 'bg-muted/30')}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-normal"
                    >
                      <p className="font-medium">{period.name}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatTime(period.startTime)}–{formatTime(period.endTime)}
                      </p>
                    </th>

                    {DAYS.map((day) => {
                      const slotKey = `${day.value}:${period.id}`;
                      const cellEntries = entriesBySlot.get(slotKey) ?? [];

                      if (period.isBreak) {
                        return (
                          <td
                            key={day.value}
                            className="px-2 py-2 text-center text-xs text-muted-foreground"
                          >
                            {period.name}
                          </td>
                        );
                      }

                      // Any non-break period is a valid drop target, even one
                      // that already holds lessons for other classes — in the
                      // unfiltered view almost every period has something in
                      // it, so restricting drops to empty cells would leave
                      // nowhere to drop. The server's clash detection is the
                      // real gate: it rejects a move only if the target slot
                      // already has this same class, teacher, or room.
                      const isDropTarget = canManage && draggingEntryId !== null;

                      return (
                        <td
                          key={day.value}
                          className={cn(
                            'p-1 align-top transition-colors',
                            isDropTarget && dragOverKey === slotKey && 'bg-primary-subtle',
                          )}
                          onDragOver={
                            isDropTarget
                              ? (event) => {
                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = 'move';
                                  setDragOverKey(slotKey);
                                }
                              : undefined
                          }
                          onDragLeave={
                            isDropTarget
                              ? () => setDragOverKey((current) => (current === slotKey ? null : current))
                              : undefined
                          }
                          onDrop={
                            isDropTarget
                              ? (event) => {
                                  event.preventDefault();
                                  setDragOverKey(null);
                                  const entryId = event.dataTransfer.getData('text/plain');
                                  const entry = (timetable.data?.entries ?? []).find(
                                    (candidate) => candidate.id === entryId,
                                  );
                                  if (entry) void moveEntry(entry, day.value, period.id);
                                }
                              : undefined
                          }
                        >
                          {cellEntries.length === 0 ? (
                            canManage ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setConflict(null);
                                  setSlot({ day: day.value, periodId: period.id });
                                }}
                                className="grid h-16 w-full place-items-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 no-print"
                                aria-label={`Add a lesson on ${day.label} in ${period.name}`}
                              >
                                <Plus className="size-4" aria-hidden="true" />
                              </button>
                            ) : (
                              <div className="h-16" />
                            )
                          ) : (
                            <div className="space-y-1">
                              {cellEntries.map((entry) => (
                                <button
                                  key={entry.id}
                                  type="button"
                                  disabled={!canManage}
                                  draggable={canManage}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', entry.id);
                                    setDraggingEntryId(entry.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggingEntryId(null);
                                    setDragOverKey(null);
                                    setDragOverTrash(false);
                                  }}
                                  onClick={() => {
                                    setConflict(null);
                                    setSlot({ day: day.value, periodId: period.id, entry });
                                  }}
                                  className={cn(
                                    'w-full rounded-md border border-primary/30 bg-primary-subtle p-2 text-left transition-colors hover:border-primary disabled:cursor-default',
                                    canManage && 'cursor-grab active:cursor-grabbing',
                                    draggingEntryId === entry.id && 'opacity-40',
                                  )}
                                >
                                  <p className="truncate text-xs font-semibold text-primary">
                                    {entry.subjectName}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {classId ? entry.teacherName : entry.className}
                                  </p>
                                  {entry.roomName && (
                                    <p className="truncate text-[11px] text-muted-foreground">
                                      {entry.roomName}
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {draggingEntryId && (
        <div className="no-print fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverTrash(true);
            }}
            onDragLeave={() => setDragOverTrash(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOverTrash(false);
              const entryId = event.dataTransfer.getData('text/plain');
              const entry = (timetable.data?.entries ?? []).find(
                (candidate) => candidate.id === entryId,
              );
              if (entry) void removeEntry(entry);
            }}
            className={cn(
              'flex items-center gap-2 rounded-full border-2 border-dashed px-5 py-2.5 text-sm font-medium shadow-lg transition-colors',
              dragOverTrash
                ? 'border-danger bg-danger text-danger-foreground'
                : 'border-border bg-card text-muted-foreground',
            )}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Drop here to remove
          </div>
        </div>
      )}

      <EntryDialog
        key={slot ? `${slot.day}-${slot.periodId}-${slot.entry?.id ?? 'new'}` : 'none'}
        slot={slot}
        conflict={conflict}
        classes={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        subjects={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
        teachers={teachers}
        rooms={(rooms.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
        defaultClassId={classId}
        defaultTeacherId={teacherId}
        saving={saveEntry.isPending}
        deleting={deleteEntry.isPending}
        onClose={() => setSlot(null)}
        onDelete={async (entryId) => {
          await deleteEntry.mutateAsync(entryId);
          setSlot(null);
        }}
        onSave={async (input) => {
          try {
            await saveEntry.mutateAsync(input);
            setSlot(null);
          } catch (error) {
            setConflict(
              isApiError(error) ? error.message : 'That lesson could not be placed.',
            );
          }
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear the entire timetable?"
        description="Every lesson is removed for every class and teacher — not just the ones your current filters show. This cannot be undone."
        confirmLabel="Clear timetable"
        tone="danger"
        confirmationPhrase="CLEAR"
        loading={clearTimetable.isPending}
        onConfirm={async () => {
          await clearTimetable.mutateAsync();
          setConfirmClear(false);
        }}
      />
    </PageContainer>
  );
}

function EntryDialog({
  slot,
  conflict,
  classes,
  subjects,
  teachers,
  rooms,
  defaultClassId,
  defaultTeacherId,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
}: {
  slot: SlotTarget | null;
  conflict: string | null;
  classes: { value: string; label: string }[];
  subjects: { value: string; label: string }[];
  teachers: { value: string; label: string }[];
  rooms: { value: string; label: string }[];
  defaultClassId: string;
  defaultTeacherId: string;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (input: {
    entryId?: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    roomId?: string | null;
    periodId: string;
    day: Weekday;
  }) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
}) {
  const [classIdValue, setClassId] = useState(slot?.entry?.classId ?? defaultClassId);
  const [subjectId, setSubjectId] = useState(slot?.entry?.subjectId ?? '');
  const [teacherIdValue, setTeacherId] = useState(slot?.entry?.teacherId ?? defaultTeacherId);
  const [roomId, setRoomId] = useState(slot?.entry?.roomId ?? '');

  const valid = Boolean(classIdValue && subjectId && teacherIdValue);
  const dayLabel = DAYS.find((day) => day.value === slot?.day)?.label ?? '';

  return (
    <Dialog open={slot !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{slot?.entry ? 'Edit lesson' : 'Add a lesson'}</DialogTitle>
          <DialogDescription>{dayLabel}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {conflict && (
            <Alert tone="danger" title="That would clash">
              {conflict}
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="entry-class" required>
              Class
            </Label>
            <NativeSelect
              id="entry-class"
              value={classIdValue}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="">Select a class</option>
              {classes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-subject" required>
              Subject
            </Label>
            <NativeSelect
              id="entry-subject"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">Select a subject</option>
              {subjects.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-teacher" required>
              Teacher
            </Label>
            <NativeSelect
              id="entry-teacher"
              value={teacherIdValue}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <option value="">Select a teacher</option>
              {teachers.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-room">Room</Label>
            <NativeSelect
              id="entry-room"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
            >
              <option value="">No specific room</option>
              {rooms.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </DialogBody>

        <DialogFooter>
          {slot?.entry && (
            <Button
              variant="danger"
              className="mr-auto"
              loading={deleting}
              onClick={() => void onDelete(slot.entry!.id)}
            >
              <Trash2 />
              Remove
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!valid}
            onClick={() =>
              slot &&
              void onSave({
                entryId: slot.entry?.id,
                classId: classIdValue,
                subjectId,
                teacherId: teacherIdValue,
                roomId: roomId || null,
                periodId: slot.periodId,
                day: slot.day,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
