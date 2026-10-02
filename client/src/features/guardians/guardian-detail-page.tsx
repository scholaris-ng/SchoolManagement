import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BadgeCheck,
  Briefcase,
  Heart,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Send,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
} from 'lucide-react';
import { formatRelative } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useStudentSearch } from '@/features/students/api';
import { useGuardian, useGuardianChildren, useInviteGuardian, useLinkStudentToGuardian } from './api';
import { linkStudentSchema, type LinkStudentValues } from './schema';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState, Tooltip } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import { CheckboxField, SelectField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/form-actions';
import { SearchInput } from '@/components/ui/input';
import { Sheet } from '@/components/ui/dialog';
import { Detail } from './guardian-detail-page-parts';
import { AddCoGuardianSheet } from './add-co-guardian-sheet';

const RELATIONSHIP_OPTIONS = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * One guardian, and every child they are responsible for.
 *
 * The relationship flags (primary contact, financially responsible, may collect
 * the child) live on the link rather than the person, because the same guardian
 * can hold different responsibilities for different children.
 */
export function GuardianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const guardian = useGuardian(id);
  const children = useGuardianChildren(id);
  const invite = useInviteGuardian();
  const [linkStudentOpen, setLinkStudentOpen] = useState(false);
  const [addGuardianOpen, setAddGuardianOpen] = useState(false);

  if (guardian.isPending) {
    return (
      <PageContainer>
        <PageHeader
          loading
          title=""
          breadcrumbs={[{ label: 'People' }, { label: 'Guardians', to: '/guardians' }]}
        />
        <LoadingState label="Loading guardian…" />
      </PageContainer>
    );
  }

  if (guardian.isError || !guardian.data) {
    return (
      <PageContainer>
        <PageHeader
          title="Guardian"
          breadcrumbs={[{ label: 'People' }, { label: 'Guardians', to: '/guardians' }]}
        />
        <ErrorState error={guardian.error} onRetry={() => void guardian.refetch()} />
      </PageContainer>
    );
  }

  const record = guardian.data;

  return (
    <PageContainer>
      <PageHeader
        // `fullName` already carries the title, so adding it here as well printed it twice.
        title={record.fullName}
        description={record.occupation ?? 'Parent / guardian'}
        breadcrumbs={[
          { label: 'People' },
          { label: 'Guardians', to: '/guardians' },
          { label: record.fullName },
        ]}
        meta={
          <>
            {record.hasPortalAccess ? (
              <Badge tone="success">
                <ShieldCheck />
                Portal active
              </Badge>
            ) : (
              <Badge tone="neutral">No portal access</Badge>
            )}
            <Badge tone="neutral">
              {record.studentCount} {record.studentCount === 1 ? 'child' : 'children'}
            </Badge>
            {record.lastLoginAt && (
              <span className="text-xs text-muted-foreground">
                Last signed in {formatRelative(record.lastLoginAt)}
              </span>
            )}
          </>
        }
        actions={
          <PermissionGate require="guardian.manage">
            <Tooltip
              content={
                record.email
                  ? undefined
                  : 'Add an email address on this guardian’s profile first.'
              }
            >
              <span className="inline-flex">
                <Button
                  variant="outline"
                  data-cy="guardian-detail-invite"
                  loading={invite.isPending}
                  disabled={!record.email}
                  onClick={() => invite.mutate(record.id)}
                >
                  <Send />
                  {record.hasPortalAccess ? 'Resend invitation' : 'Invite to portal'}
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="outline"
              data-cy="guardian-detail-add-co-guardian"
              onClick={() => setAddGuardianOpen(true)}
            >
              <Users />
              Add another guardian
            </Button>
            <Button data-cy="guardians-guardian-detail-edit" onClick={() => navigate(`/guardians/${record.id}/edit`)}>
              <Pencil />
              Edit
            </Button>
          </PermissionGate>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Avatar name={`${record.firstName} ${record.lastName}`} src={record.photoUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-medium">{record.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Added {formatRelative(record.createdAt)}
                </p>
              </div>
            </div>

            <Detail icon={<Phone />} label="Phone">
              <a href={`tel:${record.phone}`} className="hover:underline">
                {record.phone}
              </a>
              {record.altPhone && (
                <span className="text-muted-foreground"> · {record.altPhone}</span>
              )}
            </Detail>
            <Detail icon={<Mail />} label="Email">
              {record.email ? (
                <a href={`mailto:${record.email}`} className="break-all hover:underline">
                  {record.email}
                </a>
              ) : (
                <span className="text-muted-foreground">Not provided</span>
              )}
            </Detail>
            {record.occupation && (
              <Detail icon={<Briefcase />} label="Occupation">
                {record.occupation}
              </Detail>
            )}
            {record.address && (
              <Detail icon={<MapPin />} label="Address">
                {record.address}
              </Detail>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Children</CardTitle>
                <CardDescription>
                  What this guardian is responsible for, per child. These flags decide who is
                  called first, who is billed, and who may collect a child from the gate.
                </CardDescription>
              </div>
              <PermissionGate require="guardian.manage">
                <Button
                  data-cy="guardian-detail-link-student"
                  variant="outline"
                  size="sm"
                  onClick={() => setLinkStudentOpen(true)}
                >
                  <UserPlus />
                  Link a student
                </Button>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {children.isPending ? (
              <LoadingState label="Loading children…" />
            ) : children.isError ? (
              <ErrorState error={children.error} onRetry={() => void children.refetch()} compact />
            ) : (children.data?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<Heart />}
                title="No children linked yet"
                description="Link a student above, or from that child's own Guardians tab."
              />
            ) : (
              <ul className="divide-y divide-border">
                {children.data?.map((link) => (
                  <li key={link.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar name={link.studentName} src={link.studentPhotoUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/students/${link.studentId}`}
                        className="truncate font-medium hover:text-primary hover:underline"
                      >
                        {link.studentName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {link.studentAdmissionNo} · {humanizeEnum(link.relationship)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {link.isPrimaryContact && (
                        <Badge tone="primary">
                          <BadgeCheck />
                          Primary contact
                        </Badge>
                      )}
                      {link.isEmergencyContact && <Badge tone="warning">Emergency</Badge>}
                      {link.isFinanciallyResponsible && <Badge tone="info">Pays fees</Badge>}
                      {link.canPickUp && (
                        <Badge tone="neutral">
                          <Truck />
                          May collect
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AddCoGuardianSheet
        guardianName={record.fullName}
        links={children.data ?? []}
        open={addGuardianOpen}
        onOpenChange={setAddGuardianOpen}
      />

      <LinkStudentSheet
        guardianId={record.id}
        open={linkStudentOpen}
        onOpenChange={setLinkStudentOpen}
        excludeIds={(children.data ?? []).map((link) => link.studentId)}
      />
    </PageContainer>
  );
}

/**
 * The reverse of the student's own "Link a guardian" — for the moment a
 * guardian turns out to already exist (an email clash while adding a new
 * one, say) and the quickest way to attach them to the right child is from
 * right here, rather than hunting that child down to use their own sheet.
 */
function LinkStudentSheet({
  guardianId,
  open,
  onOpenChange,
  excludeIds,
}: {
  guardianId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
}) {
  const link = useLinkStudentToGuardian(guardianId);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentLabel, setStudentLabel] = useState('');
  const results = useStudentSearch(studentQuery, { enabled: studentQuery.length >= 2 });
  const matches = (results.data ?? []).filter((match) => !excludeIds.includes(match.id));

  const form = useForm<LinkStudentValues>({
    resolver: zodResolver(linkStudentSchema),
    defaultValues: {
      studentId: '',
      relationship: 'GUARDIAN',
      isPrimaryContact: false,
      isEmergencyContact: false,
      isFinanciallyResponsible: false,
      canPickUp: true,
    },
  });

  const selectedStudentId = form.watch('studentId');

  const close = () => {
    form.reset();
    setStudentQuery('');
    setStudentLabel('');
    onOpenChange(false);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    await link.mutateAsync(values);
    close();
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Link a student"
      description="Attach this guardian to a child already registered at the school."
      footer={
        <>
          <Button data-cy="guardian-link-student-cancel" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button data-cy="guardian-link-student-submit" onClick={onSubmit} loading={link.isPending}>
            Link student
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormError error={link.error} />

        {selectedStudentId && studentLabel ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <p className="truncate text-sm font-medium">{studentLabel}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                form.setValue('studentId', '', { shouldValidate: true });
                setStudentLabel('');
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="link-student-query" required>
              Student
            </Label>
            <SearchInput
              id="link-student-query"
              data-cy="guardian-link-student-query"
              value={studentQuery}
              onValueChange={setStudentQuery}
              placeholder="Search by name or admission number…"
              isSearching={results.isSearching}
            />
            {form.formState.errors.studentId && (
              <p className="text-xs text-danger">{form.formState.errors.studentId.message}</p>
            )}
            {matches.length > 0 && (
              <ul className="max-h-56 overflow-y-auto rounded-md border border-border">
                {matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      data-cy={`guardian-link-student-result-${match.id}`}
                      onClick={() => {
                        form.setValue('studentId', match.id, { shouldValidate: true });
                        setStudentLabel(`${match.fullName} · ${match.admissionNo}`);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1 truncate">{match.fullName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {match.admissionNo}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <SelectField
          control={form.control}
          name="relationship"
          label="Relationship to the student"
          required
          options={RELATIONSHIP_OPTIONS}
          native
        />

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Responsibilities</legend>
          <CheckboxField
            control={form.control}
            name="isPrimaryContact"
            label="Primary contact"
            description="The first person the school calls about this child."
          />
          <CheckboxField control={form.control} name="isEmergencyContact" label="Emergency contact" />
          <CheckboxField
            control={form.control}
            name="isFinanciallyResponsible"
            label="Financially responsible"
            description="Receives invoices and fee reminders for this child."
          />
          <CheckboxField
            control={form.control}
            name="canPickUp"
            label="Authorised to collect the child"
          />
        </fieldset>
      </form>
    </Sheet>
  );
}
