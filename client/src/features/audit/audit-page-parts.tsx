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
            <DialogHeader>
              <DialogTitle className="font-mono text-base">{entry.action}</DialogTitle>
              <DialogDescription>
                {entry.actorName} ({entry.actorRole}) · {formatDateTime(entry.occurredAt)}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail label="Record" value={`${entry.entityType} · ${entry.entityId}`} />
                <Detail label="Label" value={entry.entityLabel ?? '—'} />
                <Detail label="Severity" value={entry.severity} />
                <Detail label="IP address" value={entry.ipAddress ?? 'Not recorded'} />
                <Detail label="Request id" value={entry.requestId ?? 'Not recorded'} />
                <Detail label="User agent" value={entry.userAgent ?? 'Not recorded'} />
              </dl>

              <div className="grid gap-3 lg:grid-cols-2">
                <ChangeBlock title="Before" value={entry.before} />
                <ChangeBlock title="After" value={entry.after} />
              </div>
            </DialogBody>

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

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{value}</dd>
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
