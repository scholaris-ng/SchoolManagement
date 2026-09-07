import { humanizeEnum } from '@/lib/utils';
import { Badge, type BadgeProps } from '@/components/ui/primitives';

type Tone = NonNullable<BadgeProps['tone']>;

/**
 * One place that decides what colour a status is, so "PUBLISHED" looks the same
 * on a score sheet, a report card and an audit row.
 */
const TONE_BY_STATUS: Record<string, Tone> = {
  // Generic lifecycle
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'primary',
  PUBLISHED: 'success',
  RETURNED: 'warning',
  CANCELLED: 'neutral',
  CLOSED: 'neutral',
  OPEN: 'success',
  SCHEDULED: 'info',
  PLANNED: 'neutral',
  GRADED: 'primary',

  // Students
  GRADUATED: 'primary',
  ALUMNI: 'primary',
  TRANSFERRED: 'warning',
  WITHDRAWN: 'danger',
  SUSPENDED: 'danger',
  ON_LEAVE: 'warning',
  EXITED: 'neutral',

  // Admissions
  SCREENING: 'info',
  SHORTLISTED: 'info',
  OFFERED: 'primary',
  ACCEPTED: 'success',
  REJECTED: 'danger',

  // Attendance
  PRESENT: 'success',
  ABSENT: 'danger',
  LATE: 'warning',
  EXCUSED: 'info',

  // Finance
  ISSUED: 'info',
  PART_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  PENDING: 'warning',
  SUCCESSFUL: 'success',
  FAILED: 'danger',
  REVERSED: 'danger',

  // Discipline
  REPORTED: 'warning',
  REFERRED: 'info',
  UNDER_REVIEW: 'info',
  ACTION_TAKEN: 'primary',
  RESOLVED: 'success',
  DISMISSED: 'neutral',

  // Severity
  MINOR: 'neutral',
  MODERATE: 'warning',
  MAJOR: 'danger',
  SEVERE: 'danger',

  // Sync / imports
  COMPLETED: 'success',
  PARTIAL: 'warning',
  IMPORTING: 'info',
  VALIDATED: 'info',
  MAPPED: 'neutral',
  UPLOADED: 'neutral',

  // Risk bands
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',

  // Authorisation
  AUTHORIZED: 'success',
  REVOKED: 'danger',
  INVITED: 'info',
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge tone={TONE_BY_STATUS[status] ?? 'neutral'} className={className}>
      {label ?? humanizeEnum(status)}
    </Badge>
  );
}

export function statusTone(status: string): Tone {
  return TONE_BY_STATUS[status] ?? 'neutral';
}
