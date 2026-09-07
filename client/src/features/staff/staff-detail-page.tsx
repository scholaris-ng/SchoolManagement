import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Briefcase, CalendarDays, Mail, Pencil, Phone, Users } from 'lucide-react';
import { formatDate, formatPercent } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useStaffMember, useStaffPerformance } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const member = useStaffMember(id);
  const performance = useStaffPerformance();

  if (member.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Loading staff record…" />
      </PageContainer>
    );
  }

  if (member.isError || !member.data) {
    return (
      <PageContainer>
        <ErrorState error={member.error} onRetry={() => void member.refetch()} />
      </PageContainer>
    );
  }

  const record = member.data;
  const scorecard = performance.data?.find((row) => row.staffId === record.id);

  return (
    <PageContainer>
      <PageHeader
        title={record.fullName}
        description={`${record.designation}${record.department ? ` · ${record.department}` : ''}`}
        breadcrumbs={[
          { label: 'People' },
          { label: 'Staff', to: '/staff' },
          { label: record.fullName },
        ]}
        meta={
          <>
            <StatusBadge status={record.status} />
            <Badge tone="neutral">{record.staffNo}</Badge>
            {record.isFormTeacher && <Badge tone="primary">Form teacher</Badge>}
          </>
        }
        actions={
          <PermissionGate require="staff.manage">
            <Button onClick={() => navigate(`/staff/${record.id}/edit`)}>
              <Pencil />
              Edit
            </Button>
          </PermissionGate>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Avatar name={record.fullName} src={record.photoUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-medium">{record.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {humanizeEnum(record.employmentType)}
                </p>
              </div>
            </div>

            <Row icon={<Mail />} label="Email">
              <a href={`mailto:${record.email}`} className="break-all hover:underline">
                {record.email}
              </a>
            </Row>
            <Row icon={<Phone />} label="Phone">
              <a href={`tel:${record.phone}`} className="hover:underline">
                {record.phone}
              </a>
            </Row>
            <Row icon={<CalendarDays />} label="Employed since">
              {formatDate(record.employmentDate)}
            </Row>
            <Row icon={<Briefcase />} label="Roles">
              <span className="flex flex-wrap gap-1">
                {record.roleNames.map((role) => (
                  <Badge key={role} tone="neutral">
                    {humanizeEnum(role)}
                  </Badge>
                ))}
              </span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teaching load</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <BookOpen className="size-3.5" aria-hidden="true" />
                Subjects
              </p>
              {record.subjectNames.length === 0 ? (
                <p className="mt-1 text-muted-foreground">No subjects assigned.</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {record.subjectNames.map((subject) => (
                    <Badge key={subject} tone="info">
                      {subject}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" />
                Classes
              </p>
              {record.classNames.length === 0 ? (
                <p className="mt-1 text-muted-foreground">No classes assigned.</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {record.classNames.map((className) => (
                    <Badge key={className} tone="primary">
                      {className}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This term</CardTitle>
            <CardDescription>
              Compliance measures, not a judgement of teaching. Low numbers usually mean someone
              needs support or a lighter load.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {performance.isPending ? (
              <LoadingState label="Loading…" />
            ) : !scorecard ? (
              <EmptyState compact title="No activity recorded this term" />
            ) : (
              <>
                <Metric label="Registers taken on time" value={scorecard.attendanceCompliance} />
                <Metric label="Lesson notes submitted" value={scorecard.lessonNoteCompliance} />
                <Metric label="Scores entered on time" value={scorecard.scoreEntryTimeliness} />
                <Metric label="Curriculum covered" value={scorecard.curriculumCoverage} />
                <div className="border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">Average student score</span>
                  <span className="float-right font-medium tabular-nums">
                    {formatPercent(scorecard.averageStudentScore)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function Row({
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
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{formatPercent(value, 0)}</span>
      </div>
      <Progress
        className="mt-1"
        value={value}
        tone={value >= 85 ? 'success' : value >= 60 ? 'warning' : 'danger'}
      />
    </div>
  );
}
