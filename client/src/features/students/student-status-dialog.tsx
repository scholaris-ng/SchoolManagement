import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toDateInputValue } from '@/lib/format';
import type { Student } from '@/types/people';
import { useChangeStudentStatus } from './api';
import { statusChangeSchema, type StatusChangeValues } from './schema';
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
import { DateField, SelectField, TextField, TextareaField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/form-actions';
import { Alert } from '@/components/ui/feedback';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active — currently enrolled' },
  { value: 'GRADUATED', label: 'Graduated — completed the final class' },
  { value: 'TRANSFERRED', label: 'Transferred — moved to another school' },
  { value: 'WITHDRAWN', label: 'Withdrawn — left the school' },
  { value: 'SUSPENDED', label: 'Suspended — temporarily excluded' },
  { value: 'ALUMNI', label: 'Alumni' },
];

/**
 * Status changes are audited, so a reason is required for anything other than
 * a return to active. This is the record the school relies on months later when
 * someone asks why a child left.
 */
export function StudentStatusDialog({
  student,
  open,
  onOpenChange,
}: {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const changeStatus = useChangeStudentStatus(student.id);

  const form = useForm<StatusChangeValues>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: {
      status: student.status,
      effectiveDate: toDateInputValue(new Date()),
      reason: '',
      destinationSchool: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        status: student.status,
        effectiveDate: toDateInputValue(new Date()),
        reason: '',
        destinationSchool: '',
      });
    }
  }, [open, student.status, form]);

  const status = form.watch('status');

  const onSubmit = form.handleSubmit(async (values) => {
    await changeStatus.mutateAsync(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>Change student status</DialogTitle>
            <DialogDescription>
              This closes the current enrolment and is recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <FormError error={changeStatus.error} />

            <SelectField
              control={form.control}
              name="status"
              label="New status"
              required
              options={STATUS_OPTIONS}
              native
            />

            <DateField
              control={form.control}
              name="effectiveDate"
              label="Effective from"
              required
            />

            {status === 'TRANSFERRED' && (
              <TextField
                control={form.control}
                name="destinationSchool"
                label="Transferring to"
                required
                placeholder="Name of the receiving school"
              />
            )}

            <TextareaField
              control={form.control}
              name="reason"
              label="Reason"
              required={status !== 'ACTIVE'}
              rows={3}
              maxLength={500}
              placeholder="Why is the status changing?"
            />

            {(status === 'WITHDRAWN' || status === 'TRANSFERRED') && (
              <Alert tone="warning" title="This student will leave the register">
                They will no longer appear in class lists, attendance registers or new invoices.
                Their historical results, attendance and fee records are kept intact.
              </Alert>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={changeStatus.isPending}>
              Update status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
