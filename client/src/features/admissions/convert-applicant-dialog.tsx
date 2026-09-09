import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { isApiError } from '@/lib/api-error';
import { useClassOptions } from '@/features/academics/api';
import { useConvertAdmission } from './api';
import { conversionSchema, type ConversionValues } from './schema';
import type { AdmissionApplication } from '@/types/admissions';
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
import { SelectField, TextField } from '@/components/forms/form-field';
import { Alert } from '@/components/ui/feedback';
import { FormError } from '@/components/forms/form-actions';

/**
 * Enrolment in one step.
 *
 * The server does the whole thing in a single transaction — student, guardians,
 * guardian links, enrolment record and document transfer — so a failure part of
 * the way through cannot leave a half-created child on the roll.
 */
export function ConvertApplicantDialog({
  application,
  open,
  onOpenChange,
}: {
  application: AdmissionApplication;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const convert = useConvertAdmission(application.id);
  const classOptions = useClassOptions();

  const form = useForm<ConversionValues>({
    resolver: zodResolver(conversionSchema),
    defaultValues: { admissionNo: '', classId: application.offeredClassId ?? '' },
  });

  const applicantName = [application.applicant.firstName, application.applicant.lastName].join(' ');

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await convert.mutateAsync(values);
      onOpenChange(false);
      navigate(`/students/${result.student.id}`);
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          form.setError(field as keyof ConversionValues, { message });
        }
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Enrol {applicantName}</DialogTitle>
          <DialogDescription>
            Everything already on the application carries across — names, date of birth, guardians
            and uploaded documents. Nothing is typed twice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <DialogBody className="space-y-4">
            <FormError error={convert.error} />

            <TextField
              control={form.control}
              name="admissionNo"
              label="Admission number"
              required
              placeholder="e.g. SCH/2026/0142"
              hint="Must be unique within this school."
            />
            <SelectField
              control={form.control}
              name="classId"
              label="Class"
              required
              options={classOptions}
              placeholder="Select a class"
              native
              description={
                application.offeredClassName
                  ? `The offer was made for ${application.offeredClassName}.`
                  : undefined
              }
            />

            <Alert tone="info" title="What happens next">
              <ul className="list-disc space-y-0.5 pl-4">
                <li>A student record is created and added to the class register.</li>
                <li>
                  {application.guardians.length} guardian
                  {application.guardians.length === 1 ? '' : 's'} are created or matched by email and
                  linked to the child.
                </li>
                <li>An enrolment record is opened for the current session.</li>
                <li>Photo consent starts off, until a guardian gives it.</li>
              </ul>
            </Alert>
          </DialogBody>

          <DialogFooter>
            <Button data-cy="admissions-convert-applicant-dialog-cancel" type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button data-cy="admissions-convert-applicant-dialog-enrol-as-a-student" type="submit" loading={convert.isPending} loadingLabel="Enrolling…">
              Enrol as a student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
