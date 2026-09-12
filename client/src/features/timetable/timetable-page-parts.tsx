import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { WEEKDAYS as DAYS } from '@/lib/weekdays';
import type { Weekday } from '@/types/curriculum';
import { useSubjectOptions } from '@/features/academics/api';
import { useTeacherOptions } from '@/features/staff/api';
import { Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
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

import type { SlotTarget } from './timetable-page';

/**
 * Pieces used by `timetable-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function EntryDialog({
  slot,
  conflict,
  classes,
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

  // Narrowed to the chosen class: a class only offers the subjects its level
  // teaches and the staff actually assigned to teach it, rather than
  // everything the school runs.
  const subjects = useSubjectOptions(classIdValue ? { classId: classIdValue } : {});
  const teachers = useTeacherOptions(classIdValue ? { classId: classIdValue } : {});

  // A subject or teacher chosen for one class is not necessarily valid for
  // another, so switching the class clears both — but only on a change made
  // in this dialog, not on the initial mount that restores an existing lesson.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setSubjectId('');
    setTeacherId('');
  }, [classIdValue]);

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
              data-cy="entry-class"
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
              data-cy="entry-subject"
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
              data-cy="entry-teacher"
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
              data-cy="entry-room"
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
              data-cy="timetable-remove"
              variant="danger"
              className="mr-auto"
              loading={deleting}
              onClick={() => void onDelete(slot.entry!.id)}
            >
              <Trash2 />
              Remove
            </Button>
          )}
          <Button data-cy="timetable-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="timetable-save"
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
