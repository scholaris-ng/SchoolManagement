import { useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { useSaveClass } from '@/features/academics/api';
import { useTeacherOptions } from '@/features/staff/api';
import type { SchoolClass } from '@/types/academics';

export function ClassDialog({
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
