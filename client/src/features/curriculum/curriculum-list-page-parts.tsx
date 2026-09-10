import { useState } from 'react';
import {
  useAcademicSessions,
  useClasses,
  useSubjects,
} from '@/features/academics/api';
import { useSaveCurriculum } from './api';
import type { Curriculum } from '@/types/curriculum';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect, Textarea, Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';

/**
 * Pieces used by `curriculum-list-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function CurriculumDialog({
  state,
  onClose,
}: {
  state: { open: boolean; curriculum?: Curriculum };
  onClose: () => void;
}) {
  const save = useSaveCurriculum();
  const [classId, setClassId] = useState(state.curriculum?.classId ?? '');
  const [subjectId, setSubjectId] = useState(state.curriculum?.subjectId ?? '');
  const [name, setName] = useState(state.curriculum?.name ?? '');
  const [description, setDescription] = useState(state.curriculum?.description ?? '');

  // Only the classes this user teaches, and then only the subjects taught at
  // that class's level — so the pair on offer is always a pair that exists.
  const classes = useClasses();
  const subjects = useSubjects(classId ? { classId } : {});
  const sessions = useAcademicSessions();
  const session = sessions.data?.find((entry) => entry.isCurrent);

  const classOptions = classes.data ?? [];
  const subjectOptions = subjects.data ?? [];
  const selectedClass = classOptions.find((entry) => entry.id === classId);

  // A class change can strand the chosen subject; drop it rather than submit a
  // combination the server will reject.
  const subjectStillOffered = subjectOptions.some((subject) => subject.id === subjectId);
  const effectiveSubjectId = subjectStillOffered ? subjectId : '';

  const valid = Boolean(classId && effectiveSubjectId);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.curriculum ? 'Edit curriculum' : 'New curriculum'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="curriculum-class" required>
                Class
              </Label>
              <NativeSelect
                data-cy="curriculum-class"
                id="curriculum-class"
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
              >
                <option value="">Select a class</option>
                {classOptions.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                {selectedClass
                  ? `Level: ${selectedClass.levelName}`
                  : 'The level follows the class you pick.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="curriculum-subject" required>
                Subject
              </Label>
              <NativeSelect
                data-cy="curriculum-subject"
                id="curriculum-subject"
                value={effectiveSubjectId}
                disabled={!classId || subjects.isPending}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">
                  {classId ? 'Select a subject' : 'Pick a class first'}
                </option>
                {subjectOptions.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </NativeSelect>
              {classId && !subjects.isPending && subjectOptions.length === 0 && (
                <p className="text-xs text-danger">
                  You are not assigned any subject in this class.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curriculum-name">Name</Label>
            <Input
              data-cy="curriculum-name"
              id="curriculum-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Defaults to the subject and class"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curriculum-description">Description</Label>
            <Textarea
              data-cy="curriculum-description"
              id="curriculum-description"
              value={description ?? ''}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this curriculum covers"
            />
          </div>

          {/* The session is the school's current one, not a choice: writing
              next year's plan starts by making next year current. */}
          <Alert tone="info">
            {state.curriculum
              ? `This curriculum belongs to ${state.curriculum.sessionName}. Its session cannot be changed.`
              : `It will be filed under ${session?.name ?? 'the current session'}, the session this school is working in.`}
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="curriculum-list-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="curriculum-list-save"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.curriculum?.id,
                  values: {
                    subjectId: effectiveSubjectId,
                    classId,
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
