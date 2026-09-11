import * as Popover from '@radix-ui/react-popover';
import { Link } from 'react-router-dom';
import { AlertOctagon, CheckCircle2, Download, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/primitives';
import { useActiveImport } from '@/features/imports/api';
import { IMPORT_ENTITY_LABEL } from '@/features/imports/columns';

/**
 * How far the running import has got, from anywhere in the app.
 *
 * A bulk import outlives the page that started it, so this is what lets a
 * school start one and get on with something else. It appears only when there
 * is an import to report and goes away when its result is dismissed.
 */
export function ImportIndicator({ className }: { className?: string }) {
  const { record, job, isRunning, percent, dismiss } = useActiveImport();

  if (!record || record.dismissed) return null;

  const label = IMPORT_ENTITY_LABEL[record.entity] ?? record.entity;
  const status = job?.status;
  const failed = status === 'FAILED';
  const partial = status === 'PARTIAL';
  const done = status === 'COMPLETED';

  const icon = failed ? AlertOctagon : done || partial ? CheckCircle2 : UploadCloud;
  const Icon = icon;

  const downloadErrorReport = () => {
    if (!job) return;
    void exportRowsToXlsx(
      `import-errors-${new Date().toISOString().slice(0, 10)}.xlsx`,
      job.issues.map((issue) => ({
        Row: issue.rowNumber,
        Severity: issue.severity,
        Field: issue.field ?? '',
        Problem: issue.message,
        Value: issue.value ?? '',
      })),
      { sheetName: 'Import errors' },
    );
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-cy="import-indicator"
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent',
            className,
          )}
          aria-label={
            isRunning
              ? `Importing ${label}, ${percent}% done`
              : `${label} import ${failed ? 'failed' : 'finished'}`
          }
        >
          <Icon
            className={cn(
              'size-3.5',
              failed && 'text-danger',
              partial && 'text-warning',
              done && 'text-success',
              isRunning && 'animate-pulse text-info',
            )}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isRunning ? `Importing ${percent}%` : failed ? 'Import failed' : 'Import done'}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-0 shadow-popover animate-in"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{label} import</p>
              <p className="truncate text-xs text-muted-foreground">{record.fileName}</p>
            </div>
            {!isRunning && (
              <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss">
                <X />
              </Button>
            )}
          </div>

          <div className="space-y-3 p-3">
            {isRunning ? (
              <>
                <Progress
                  value={percent}
                  showLabel
                  tone="primary"
                  aria-label={`${percent} per cent imported`}
                />
                <p className="text-xs text-muted-foreground">
                  {(job?.processedRows ?? 0).toLocaleString()} of{' '}
                  {record.totalRows.toLocaleString()} rows. You can carry on working — this
                  keeps going on the server.
                </p>
              </>
            ) : job ? (
              <>
                <p className="text-sm">
                  {failed
                    ? 'Nothing was saved.'
                    : `${job.created.toLocaleString()} created · ${job.updated.toLocaleString()} updated · ${job.skipped.toLocaleString()} skipped`}
                </p>
                {job.failed > 0 && (
                  <p className="text-xs text-danger">
                    {job.failed.toLocaleString()} row{job.failed === 1 ? '' : 's'} could not be
                    saved.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {job.issues.length > 0 && (
                    <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                      <Download />
                      Download report
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/imports">Import another file</Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Starting…</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
