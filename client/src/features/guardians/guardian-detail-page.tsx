import { Link, useNavigate, useParams } from 'react-router-dom';
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
} from 'lucide-react';
import { formatRelative } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useGuardian, useGuardianChildren, useInviteGuardian } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';

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

  if (guardian.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Loading guardian…" />
      </PageContainer>
    );
  }

  if (guardian.isError || !guardian.data) {
    return (
      <PageContainer>
        <ErrorState error={guardian.error} onRetry={() => void guardian.refetch()} />
      </PageContainer>
    );
  }

  const record = guardian.data;

  return (
    <PageContainer>
      <PageHeader
        title={`${record.title ? `${record.title} ` : ''}${record.fullName}`}
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
            <Button
              variant="outline"
              loading={invite.isPending}
              onClick={() => invite.mutate(record.id)}
            >
              <Send />
              {record.hasPortalAccess ? 'Resend invitation' : 'Invite to portal'}
            </Button>
            <Button onClick={() => navigate(`/guardians/${record.id}/edit`)}>
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
              <Avatar name={record.fullName} src={record.photoUrl} size="lg" />
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
              <a href={`mailto:${record.email}`} className="break-all hover:underline">
                {record.email}
              </a>
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
            <CardTitle>Children</CardTitle>
            <CardDescription>
              What this guardian is responsible for, per child. These flags decide who is called
              first, who is billed, and who may collect a child from the gate.
            </CardDescription>
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
                description="Link this guardian from a student's Guardians tab."
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
    </PageContainer>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="min-w-0">{children}</p>
      </div>
    </div>
  );
}
