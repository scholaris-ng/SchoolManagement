import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/toast-bus';
import type { GuardianRelationship, StudentGuardianLink } from '@/types/people';
import { useAddCoGuardian } from './use-add-co-guardian';
import { coGuardianSchema, type CoGuardianValues } from './schema';
import { TITLE_OPTIONS } from './titles';
import { Checkbox, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/dialog';
import { CheckboxField, SelectField, TextField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/form-actions';

const RELATIONSHIP_OPTIONS = [
  { value: 'MOTHER', label: 'Mother' },
  { value: 'FATHER', label: 'Father' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'OTHER', label: 'Other' },
];

/** The other parent: a father's page most likely wants a mother, and the reverse. */
function likelyRelationship(links: StudentGuardianLink[]): GuardianRelationship {
  const existing = links[0]?.relationship;
  if (existing === 'FATHER') return 'MOTHER';
  if (existing === 'MOTHER') return 'FATHER';
  return 'GUARDIAN';
}

function defaultsFor(links: StudentGuardianLink[]): CoGuardianValues {
  return {
    relationship: likelyRelationship(links),
    title: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    studentIds: links.map((link) => link.studentId),
    isPrimaryContact: false,
    isEmergencyContact: false,
    isFinanciallyResponsible: false,
    canPickUp: true,
  };
}

/**
 * Adds a second guardian for the children of the one being viewed, without
 * leaving the page — a household's other parent, usually. Everything about the
 * person is optional except a name and a phone number; the children are
 * pre-selected, since the common case is "all of them".
 */
export function AddCoGuardianSheet({
  guardianName,
  links,
  open,
  onOpenChange,
}: {
  guardianName: string;
  /** The children the viewed guardian is linked to. */
  links: StudentGuardianLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const add = useAddCoGuardian();

  const form = useForm<CoGuardianValues>({
    resolver: zodResolver(coGuardianSchema),
    defaultValues: defaultsFor(links),
  });

  // The children load separately from the page, and the relationship default
  // depends on them, so the form is reset each time the sheet opens.
  const childKey = links.map((link) => link.studentId).join(',');
  useEffect(() => {
    if (open) form.reset(defaultsFor(links));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `childKey` stands in for `links`.
  }, [open, childKey, form]);

  const selected = form.watch('studentIds');

  const close = () => {
    add.reset();
    onOpenChange(false);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (links.length > 0 && values.studentIds.length === 0) {
      form.setError('studentIds', { message: 'Select at least one child' });
      return;
    }

    const { guardian, failedCount } = await add.mutateAsync(values);
    const openGuardian = { label: 'Open', onClick: () => navigate(`/guardians/${guardian.id}`) };

    if (values.studentIds.length === 0) {
      toast.success('Guardian added', {
        description: `${guardian.fullName} isn’t linked to a child yet.`,
        action: openGuardian,
      });
    } else if (failedCount > 0) {
      toast.warning(`${guardian.fullName} was added, but not linked to every child`, {
        description: `${failedCount} link${failedCount === 1 ? '' : 's'} failed. Use “Link a student” on their page.`,
        action: openGuardian,
      });
    } else {
      toast.success('Guardian added', {
        description: `${guardian.fullName} is linked to ${values.studentIds.length} ${values.studentIds.length === 1 ? 'child' : 'children'}.`,
        action: openGuardian,
      });
    }
    close();
  });

  const toggleChild = (studentId: string, checked: boolean) => {
    const next = checked ? [...selected, studentId] : selected.filter((id) => id !== studentId);
    form.setValue('studentIds', next, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Add another guardian"
      description={`A second parent or guardian for ${guardianName}’s children — the mother, for instance.`}
      footer={
        <>
          <Button data-cy="guardian-add-co-guardian-cancel" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            data-cy="guardian-add-co-guardian-submit"
            onClick={onSubmit}
            loading={add.isPending}
          >
            Add guardian
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError error={add.error} />

        <SelectField
          control={form.control}
          name="relationship"
          label="Relationship to the children"
          required
          options={RELATIONSHIP_OPTIONS}
          native
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="title"
            label="Title"
            options={TITLE_OPTIONS}
            placeholder="No title"
            native
          />
          <span className="hidden sm:block" aria-hidden="true" />
          <TextField control={form.control} name="firstName" label="First name" required />
          <TextField control={form.control} name="lastName" label="Surname" required />
          <TextField
            control={form.control}
            name="phone"
            label="Phone number"
            type="tel"
            autoComplete="tel"
            required
          />
          <TextField
            control={form.control}
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            hint="Optional — only needed for a parent-portal account, now or later."
          />
        </div>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Children</legend>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {guardianName} has no children linked yet, so this guardian will be added on their
              own. Use “Link a student” on their page to attach them to a child afterwards.
            </p>
          ) : (
            links.map((link) => (
              <div key={link.studentId} className="flex items-start gap-2.5">
                <Checkbox
                  id={`co-guardian-child-${link.studentId}`}
                  data-cy={`guardian-add-co-guardian-child-${link.studentId}`}
                  checked={selected.includes(link.studentId)}
                  onCheckedChange={(checked) => toggleChild(link.studentId, checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor={`co-guardian-child-${link.studentId}`} className="cursor-pointer">
                  {link.studentName}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {link.studentAdmissionNo}
                  </span>
                </Label>
              </div>
            ))
          )}
          {form.formState.errors.studentIds && (
            <p role="alert" className="text-xs text-danger">
              {form.formState.errors.studentIds.message}
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Responsibilities</legend>
          <CheckboxField
            control={form.control}
            name="isPrimaryContact"
            label="Primary contact"
            description="The first person the school calls. Replaces the current primary contact for these children."
          />
          <CheckboxField control={form.control} name="isEmergencyContact" label="Emergency contact" />
          <CheckboxField
            control={form.control}
            name="isFinanciallyResponsible"
            label="Financially responsible"
            description="Receives invoices and fee reminders for these children."
          />
          <CheckboxField
            control={form.control}
            name="canPickUp"
            label="Authorised to collect the children"
          />
        </fieldset>
      </form>
    </Sheet>
  );
}
