import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, GraduationCap, RotateCcw } from 'lucide-react';
import { useAcademicSessions, useClasses } from '@/features/academics/api';
import { useStudents, usePromoteStudents } from './api';
import { promotionSchema, type PromotionValues } from './schema';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SelectField, TextareaField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/form-actions';
import { Alert, LoadingState } from '@/components/ui/feedback';
import { Avatar, Badge, Checkbox } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * End-of-session promotion.
 *
 * Promotion appends a new enrolment rather than editing the old one, so a
 * student's academic history stays intact and a transcript can still be built
 * from it years later (spec section 7).
 */
export function PromoteStudentsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sessions = useAcademicSessions();
  const classes = useClasses();
  const promote = usePromoteStudents();

  const form = useForm<PromotionValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      sessionId: '',
      nextSessionId: '',
      fromClassId: '',
      toClassId: '',
      repeatStudentIds: [],
      graduateStudentIds: [],
      note: '',
    },
  });

  const fromClassId = form.watch('fromClassId');
  const repeatIds = form.watch('repeatStudentIds');
  const graduateIds = form.watch('graduateStudentIds');

  const roster = useStudents(
    fromClassId ? { classId: fromClassId, status: 'ACTIVE', pageSize: 200 } : { pageSize: 0 },
  );

  useEffect(() => {
    if (!open) {
      form.reset();
      return;
    }
    const current = sessions.data?.find((session) => session.isCurrent);
    if (current) form.setValue('sessionId', current.id);
  }, [open, sessions.data, form]);

  const sessionOptions = useMemo(
    () => (sessions.data ?? []).map((session) => ({ value: session.id, label: session.name })),
    [sessions.data],
  );

  const classOptions = useMemo(
    () =>
      (classes.data ?? []).map((schoolClass) => ({
        value: schoolClass.id,
        label: schoolClass.name,
        description: `${schoolClass.levelName} · ${schoolClass.enrolledCount} students`,
      })),
    [classes.data],
  );

  const students = roster.data?.items ?? [];
  const promotedCount = students.filter(
    (student) => !repeatIds.includes(student.id) && !graduateIds.includes(student.id),
  ).length;

  const toggle = (field: 'repeatStudentIds' | 'graduateStudentIds', studentId: string) => {
    const current = form.getValues(field);
    const other = field === 'repeatStudentIds' ? 'graduateStudentIds' : 'repeatStudentIds';
    if (current.includes(studentId)) {
      form.setValue(field, current.filter((id) => id !== studentId));
    } else {
      form.setValue(field, [...current, studentId]);
      // A student cannot both repeat and graduate.
      form.setValue(
        other,
        form.getValues(other).filter((id) => id !== studentId),
      );
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    await promote.mutateAsync(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <form onSubmit={onSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>Promote a class</DialogTitle>
            <DialogDescription>
              Moves every student in the class into the next one for the new session. Previous
              enrolments are kept, so results and transcripts remain intact.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <FormError error={promote.error} />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="sessionId"
                label="Session ending"
                required
                options={sessionOptions}
                native
              />
              <SelectField
                control={form.control}
                name="nextSessionId"
                label="New session"
                required
                options={sessionOptions}
                native
              />
              <SelectField
                control={form.control}
                name="fromClassId"
                label="Promote from"
                required
                options={classOptions}
                native
              />
              <SelectField
                control={form.control}
                name="toClassId"
                label="Promote to"
                required
                options={classOptions}
                native
              />
            </div>

            {fromClassId && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">
                    <ArrowRight /> {promotedCount} promoted
                  </Badge>
                  <Badge tone="warning">
                    <RotateCcw /> {repeatIds.length} repeating
                  </Badge>
                  <Badge tone="primary">
                    <GraduationCap /> {graduateIds.length} graduating
                  </Badge>
                </div>

                <Alert tone="info">
                  Everyone is promoted by default. Tick a student below only if they are repeating
                  the class or leaving the school.
                </Alert>

                {roster.isPending ? (
                  <LoadingState label="Loading class list…" />
                ) : students.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    There are no active students in that class.
                  </p>
                ) : (
                  <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-md border border-border">
                    <ul className="divide-y divide-border">
                      {students.map((student) => {
                        const repeating = repeatIds.includes(student.id);
                        const graduating = graduateIds.includes(student.id);
                        return (
                          <li
                            key={student.id}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2',
                              repeating && 'bg-warning-subtle',
                              graduating && 'bg-primary-subtle',
                            )}
                          >
                            <Avatar
                              name={student.fullName}
                              src={student.photoUrl}
                              suppressPhoto={!student.photoConsent}
                              size="xs"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{student.fullName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {student.admissionNo}
                              </p>
                            </div>
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Checkbox
                                data-cy="promote-students-dialog-repeating"
                                checked={repeating}
                                onCheckedChange={() => toggle('repeatStudentIds', student.id)}
                                aria-label={`${student.fullName} repeats the class`}
                              />
                              Repeat
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Checkbox
                                data-cy="promote-students-dialog-graduating"
                                checked={graduating}
                                onCheckedChange={() => toggle('graduateStudentIds', student.id)}
                                aria-label={`${student.fullName} graduates`}
                              />
                              Graduate
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <TextareaField
              control={form.control}
              name="note"
              label="Note"
              rows={2}
              placeholder="Recorded against the promotion in the audit trail."
            />
          </DialogBody>

          <DialogFooter>
            <Button data-cy="students-promote-students-dialog-cancel" type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button data-cy="students-promote-students-dialog-promote-students" type="submit" loading={promote.isPending} disabled={!fromClassId}>
              Promote {promotedCount} students
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
