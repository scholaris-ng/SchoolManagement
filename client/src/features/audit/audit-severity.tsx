import type { AuditLogEntry } from '@/types/engagement';
import { Badge } from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/feedback';

type Severity = AuditLogEntry['severity'];

const SEVERITY_TONE = {
  INFO: 'neutral',
  WARNING: 'warning',
  CRITICAL: 'danger',
} as const;

/**
 * What each level tells a reader. The server fixes a severity per action when
 * it writes the entry, so these describe the kinds of action that get each one
 * — keep them in step with `severity:` on the `audit.record(...)` calls.
 *
 * WARNING is the one people ask about, so it says outright that it is not a
 * failure: only changes that went through are ever recorded.
 */
export const SEVERITY_MEANING: Record<Severity, string> = {
  INFO: 'A routine change, such as something being created or edited.',
  WARNING:
    'A sensitive change, such as a deletion, a reversal, or a change to who can reach a child. Worth a second look — it is not an error.',
  CRITICAL:
    'A change to who can do what: a role, its permissions, or a staff account. School administrators are notified when one is recorded.',
};

/**
 * The severity badge, with its meaning on hover.
 *
 * Deliberately not a tab stop. In the list that would add a stop to every row,
 * and in the detail dialog the badge sits ahead of the close button, so Radix's
 * opening focus would land on it and pop the tooltip open unasked. Screen
 * readers get the meaning as text instead (`describe`), where there is room.
 */
export function SeverityBadge({
  severity,
  describe = false,
  className,
}: {
  severity: Severity;
  /** Also write the meaning out for assistive technology. */
  describe?: boolean;
  className?: string;
}) {
  return (
    <Tooltip content={SEVERITY_MEANING[severity]}>
      {/* `Badge` is a plain function component and does not forward refs, so a
          real DOM node is needed for the tooltip to anchor to. */}
      <span data-cy={`audit-severity-${severity.toLowerCase()}`} className="inline-flex">
        <Badge tone={SEVERITY_TONE[severity]} className={className}>
          {severity}
        </Badge>
        {describe && <span className="sr-only">. {SEVERITY_MEANING[severity]}</span>}
      </span>
    </Tooltip>
  );
}
