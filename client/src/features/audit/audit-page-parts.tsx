import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import type { AuditLogEntry } from '@/types/engagement';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AuditChangeList } from './audit-change-list';
import { SeverityBadge } from './audit-severity';
import {
  carriesMoney,
  describeAction,
  describeRecordType,
  describeRole,
} from './audit-labels';
import { buildRows, routeForRecord } from './audit-values';

/**
 * Pieces used by `audit-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function AuditDetailDialog({
  entry,
  onOpenChange,
}: {
  entry: AuditLogEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {entry && (
          <>
            <AuditDetailBody entry={entry} />
            <DialogFooter>
              <Button data-cy="audit-close" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditDetailBody({ entry }: { entry: AuditLogEntry }) {
  const references = entry.references ?? {};
  const rows = buildRows(entry.before, entry.after, {
    references,
    money: carriesMoney(entry.entityType),
  });

  const record = references[entry.entityId];
  // The label written with the entry is what the record was called at the time;
  // the resolved name is only a fallback for the few entries written without one.
  const recordName = entry.entityLabel || record?.label;
  const openTo = record && !record.removed ? routeForRecord(record.type, entry.entityId) : null;

  const heading = entry.before && entry.after
    ? 'What changed'
    : entry.before
      ? 'How it was before'
      : 'Details';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base">{describeAction(entry.action)}</DialogTitle>
        <DialogDescription>
          {entry.actorName} · {describeRole(entry.actorRole)} · {formatDateTime(entry.occurredAt)}{' '}
          <SeverityBadge severity={entry.severity} describe className="ml-1 align-middle" />
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Record type" value={describeRecordType(entry.entityType)} />
          <Detail
            label="Record"
            value={
              <>
                {recordName ?? 'Not recorded'}
                {record?.removed && (
                  <span className="ml-1 text-xs text-muted-foreground">(deleted)</span>
                )}
                {openTo && (
                  <Link
                    to={openTo}
                    data-cy="audit-open-record"
                    className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                )}
              </>
            }
          />
        </dl>

        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {heading}
          </h3>
          {rows.length > 0 ? (
            <AuditChangeList rows={rows} />
          ) : (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              No further details were recorded for this action.
            </p>
          )}
        </section>

        {/* Ids and raw values, for whoever has to trace a request through the logs. */}
        <details data-cy="audit-technical" className="rounded-md border border-border">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            Technical details
          </summary>
          <div className="space-y-4 border-t border-border p-3">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Action code" value={entry.action} mono />
              <Detail label="Record ID" value={entry.entityId} mono />
              <Detail label="Request ID" value={entry.requestId ?? 'Not recorded'} mono />
              <Detail label="IP address" value={entry.ipAddress ?? 'Not recorded'} />
              <div className="sm:col-span-2">
                <Detail label="User agent" value={entry.userAgent ?? 'Not recorded'} />
              </div>
            </dl>
            <div className="grid gap-3 lg:grid-cols-2">
              <ChangeBlock title="Before (as stored)" value={entry.before} />
              <ChangeBlock title="After (as stored)" value={entry.after} />
            </div>
          </div>
        </details>
      </DialogBody>
    </>
  );
}

export function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? 'mt-0.5 break-all font-mono text-xs' : 'mt-0.5 break-words text-sm'}>
        {value}
      </dd>
    </div>
  );
}

export function ChangeBlock({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown> | null | undefined;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {value === null || value === undefined ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Not recorded
        </p>
      ) : (
        <pre className="scrollbar-thin max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
          <code>{JSON.stringify(value, null, 2)}</code>
        </pre>
      )}
    </div>
  );
}
