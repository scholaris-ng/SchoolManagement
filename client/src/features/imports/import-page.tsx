import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatFileSize } from '@/lib/format';
import { exportRowsToXlsx, parseXlsx, suggestColumnMapping } from '@/lib/xlsx';
import { FILE_PRESETS, FileValidationError, validateFile } from '@/lib/file-storage';
import type {
  ImportEntity,
  ImportMapping,
  ImportPreview,
  ImportResult,
  ImportSessionFile,
} from '@/types/imports';
import { useCommitImport, useImportJobs, useValidateImport } from './api';
import {
  IMPORT_ENTITY_DESCRIPTION,
  IMPORT_ENTITY_LABEL,
  IMPORT_TARGETS,
  templateSheetFor,
} from './columns';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { Alert, EmptyState, LoadingState } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/data/status-badge';

const ENTITIES: ImportEntity[] = ['STUDENTS', 'GUARDIANS', 'STAFF', 'SUBJECTS', 'FEES'];
const STEPS = ['Choose', 'Upload', 'Map columns', 'Review', 'Done'] as const;

/**
 * The bulk-import wizard.
 *
 * A school arriving with three years of history in a spreadsheet is the normal
 * case, not the exception, so this is a first-class workflow: choose what is
 * being imported, upload, map the columns, see exactly what will happen, then
 * commit. Nothing is written until the final step, and the server applies the
 * file in one transaction (spec section 9).
 */
export function ImportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const entityParam = (searchParams.get('entity') as ImportEntity | null) ?? null;

  const [entity, setEntity] = useState<ImportEntity | null>(
    entityParam && ENTITIES.includes(entityParam) ? entityParam : null,
  );
  const [file, setFile] = useState<ImportSessionFile | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [skipInvalidRows, setSkipInvalidRows] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const validate = useValidateImport();
  const commit = useCommitImport();
  const jobs = useImportJobs();

  const targets = useMemo(() => (entity ? IMPORT_TARGETS[entity] : []), [entity]);

  const step = result ? 4 : preview ? 3 : file ? 2 : entity ? 1 : 0;

  const missingRequired = useMemo(
    () => targets.filter((target) => target.required && !mapping[target.key]),
    [targets, mapping],
  );

  const chooseEntity = (next: ImportEntity) => {
    setEntity(next);
    setSearchParams({ entity: next }, { replace: true });
    resetFile();
  };

  function resetFile() {
    setFile(null);
    setRows([]);
    setMapping({});
    setPreview(null);
    setResult(null);
    setFileError(null);
  }

  const handleFile = async (selected: File) => {
    setFileError(null);
    try {
      validateFile(selected, 'spreadsheet');
    } catch (error) {
      setFileError(
        error instanceof FileValidationError ? error.message : 'That file could not be read.',
      );
      return;
    }

    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      setFileError(
        'Please upload an Excel workbook (.xlsx). If yours is an older .xls or a CSV, open it in Excel and use File → Save as → Excel Workbook.',
      );
      return;
    }

    let parsed;
    try {
      parsed = await parseXlsx(selected);
    } catch {
      setFileError(
        'That workbook could not be opened. Check it is not password-protected, then try again.',
      );
      return;
    }

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setFileError(
        'That workbook has no rows we could read. Check the first sheet has a header row and data below it.',
      );
      return;
    }

    setRows(parsed.rows);
    setFile({
      fileName: selected.name,
      sizeBytes: selected.size,
      rowCount: parsed.rows.length,
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 5),
    });
    setMapping(suggestColumnMapping(parsed.headers, entity ? IMPORT_TARGETS[entity] : []));
    setPreview(null);
    setResult(null);
  };

  const runValidation = async () => {
    if (!entity || !file) return;
    const outcome = await validate.mutateAsync({
      entity,
      fileName: file.fileName,
      mapping,
      rows,
    });
    setPreview(outcome);
  };

  const runCommit = async () => {
    if (!preview) return;
    const outcome = await commit.mutateAsync({ importId: preview.importId, skipInvalidRows });
    setResult(outcome);
  };

  const downloadErrorReport = () => {
    const issues = result?.issues ?? preview?.issues ?? [];
    void exportRowsToXlsx(
      `import-errors-${new Date().toISOString().slice(0, 10)}.xlsx`,
      issues.map((issue) => ({
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
    <PageContainer>
      <PageHeader
        title="Bulk import"
        description="Bring an existing register in from a spreadsheet. Nothing is saved until you confirm the final step."
        breadcrumbs={[{ label: 'People' }, { label: 'Bulk import' }]}
        actions={
          entity && (
            <Button
              variant="outline"
              onClick={() => {
                const template = templateSheetFor(entity);
                void exportRowsToXlsx(
                  `${entity.toLowerCase()}-import-template.xlsx`,
                  template.rows,
                  { headers: template.headers, sheetName: IMPORT_ENTITY_LABEL[entity] },
                );
              }}
            >
              <Download />
              Download template
            </Button>
          )
        }
      />

      <Stepper current={step} />

      {/* Step 1 — what are we importing? --------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>1. What are you importing?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ENTITIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseEntity(option)}
                aria-pressed={entity === option}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors',
                  entity === option
                    ? 'border-primary bg-primary-subtle'
                    : 'border-border hover:border-primary/40 hover:bg-accent/40',
                )}
              >
                <p className="font-medium">{IMPORT_ENTITY_LABEL[option]}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {IMPORT_ENTITY_DESCRIPTION[option]}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — upload --------------------------------------------------- */}
      {entity && (
        <Card>
          <CardHeader>
            <CardTitle>2. Upload your file</CardTitle>
            <CardDescription>
              Excel workbook (.xlsx), up to {formatFileSize(FILE_PRESETS.spreadsheet.maxBytes)}. The
              first sheet is read in your browser for this preview — it is only sent when you
              validate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fileError && <Alert tone="danger">{fileError}</Alert>}

            {file ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.sheetName && <>Sheet &ldquo;{file.sheetName}&rdquo; · </>}
                    {file.rowCount.toLocaleString()} rows · {file.headers.length} columns ·{' '}
                    {formatFileSize(file.sizeBytes)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={resetFile}>
                  <RotateCcw />
                  Choose another file
                </Button>
              </div>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) void handleFile(selected);
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">Choose an Excel file</span>
                  <span className="text-xs text-muted-foreground">
                    Not sure of the format? Download the template above and fill it in.
                  </span>
                </button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3 — mapping --------------------------------------------------- */}
      {entity && file && (
        <Card>
          <CardHeader>
            <CardTitle>3. Match your columns</CardTitle>
            <CardDescription>
              We have guessed from your headings. Check the required fields — the rest are optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {targets.map((target) => (
                <div key={target.key} className="space-y-1.5">
                  <Label htmlFor={`map-${target.key}`} required={target.required}>
                    {target.label}
                  </Label>
                  {target.description && (
                    <p className="text-xs text-muted-foreground">{target.description}</p>
                  )}
                  <NativeSelect
                    id={`map-${target.key}`}
                    value={mapping[target.key] ?? ''}
                    invalid={target.required && !mapping[target.key]}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [target.key]: event.target.value || null,
                      }))
                    }
                  >
                    <option value="">Not in my file</option>
                    {file.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </NativeSelect>
                  {mapping[target.key] && file.sampleRows[0] && (
                    <p className="truncate text-xs text-muted-foreground">
                      First row: {file.sampleRows[0][mapping[target.key] as string] || '(blank)'}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {missingRequired.length > 0 && (
              <Alert tone="warning" title="Some required columns are not matched">
                {missingRequired.map((target) => target.label).join(', ')}
              </Alert>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => void runValidation()}
                loading={validate.isPending}
                loadingLabel="Checking your file…"
                disabled={missingRequired.length > 0}
              >
                Check the file
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — review ---------------------------------------------------- */}
      {preview && !result && (
        <Card>
          <CardHeader>
            <CardTitle>4. Review before importing</CardTitle>
            <CardDescription>
              Nothing has been saved yet. This is exactly what will happen when you confirm.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Tally label="Rows in file" value={preview.totalRows} />
              <Tally label="Ready to import" value={preview.validRows} tone="success" />
              <Tally label="With errors" value={preview.errorRows} tone="danger" />
              <Tally label="Duplicates" value={preview.duplicateRows} tone="warning" />
            </div>

            {preview.issues.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="flex items-center justify-between gap-2 border-b border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
                    {preview.issues.length} problem{preview.issues.length === 1 ? '' : 's'} found
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                    <Download />
                    Download report
                  </Button>
                </div>
                <div className="scrollbar-thin max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">
                      Validation problems found in the uploaded file
                    </caption>
                    <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left">Row</th>
                        <th scope="col" className="px-3 py-2 text-left">Field</th>
                        <th scope="col" className="px-3 py-2 text-left">Problem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.issues.slice(0, 200).map((issue, index) => (
                        <tr key={`${issue.rowNumber}-${index}`}>
                          <td className="px-3 py-1.5 tabular-nums">{issue.rowNumber}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{issue.field ?? '—'}</td>
                          <td className="px-3 py-1.5">
                            <Badge tone={issue.severity === 'ERROR' ? 'danger' : 'warning'}>
                              {issue.severity === 'ERROR' ? 'Error' : 'Warning'}
                            </Badge>{' '}
                            {issue.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.preview.length > 0 && (
              <div className="rounded-lg border border-border">
                <p className="border-b border-border p-3 text-sm font-medium">
                  First rows, as they will be saved
                </p>
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Preview of the first rows after mapping</caption>
                    <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {targets
                          .filter((target) => mapping[target.key])
                          .map((target) => (
                            <th key={target.key} scope="col" className="whitespace-nowrap px-3 py-2 text-left">
                              {target.label}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.preview.map((row, index) => (
                        <tr key={index}>
                          {targets
                            .filter((target) => mapping[target.key])
                            .map((target) => (
                              <td key={target.key} className="whitespace-nowrap px-3 py-1.5">
                                {row[target.key] || '—'}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.errorRows > 0 && (
              <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={skipInvalidRows}
                  onChange={(event) => setSkipInvalidRows(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-input"
                />
                <span>
                  <span className="font-medium">Import the good rows and skip the bad ones</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    With this off, a single bad row stops the whole import and nothing is saved.
                  </span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>
                <ArrowLeft />
                Back to mapping
              </Button>
              <Button
                onClick={() => void runCommit()}
                loading={commit.isPending}
                loadingLabel="Importing…"
                disabled={preview.validRows === 0 || (preview.errorRows > 0 && !skipInvalidRows)}
              >
                Import {preview.validRows.toLocaleString()} row
                {preview.validRows === 1 ? '' : 's'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5 — result ---------------------------------------------------- */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import finished</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert
              tone={
                result.status === 'COMPLETED'
                  ? 'success'
                  : result.status === 'PARTIAL'
                    ? 'warning'
                    : 'danger'
              }
              title={
                result.status === 'COMPLETED'
                  ? 'Everything imported'
                  : result.status === 'PARTIAL'
                    ? 'Imported, with some rows skipped'
                    : 'Nothing was imported'
              }
            >
              {result.created} created · {result.updated} updated · {result.skipped} skipped ·{' '}
              {result.failed} failed
            </Alert>

            <div className="flex flex-wrap gap-2">
              {result.issues.length > 0 && (
                <Button variant="outline" onClick={downloadErrorReport}>
                  <Download />
                  Download error report
                </Button>
              )}
              <Button variant="outline" onClick={resetFile}>
                <RotateCcw />
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent imports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.isPending ? (
            <LoadingState label="Loading history…" />
          ) : (jobs.data?.items.length ?? 0) === 0 ? (
            <EmptyState compact icon={<FileSpreadsheet />} title="No imports run yet" />
          ) : (
            <ul className="divide-y divide-border">
              {jobs.data?.items.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {IMPORT_ENTITY_LABEL[job.entity]} · {job.fileName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {job.startedByName} · {formatDateTime(job.startedAt)}
                    </p>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    {job.created} of {job.totalRows} rows
                  </span>
                  <StatusBadge status={job.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Import progress">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1',
              index < current
                ? 'bg-success-subtle text-success'
                : index === current
                  ? 'bg-primary-subtle font-medium text-primary'
                  : 'text-muted-foreground',
            )}
            aria-current={index === current ? 'step' : undefined}
          >
            {index < current ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <span className="tabular-nums">{index + 1}.</span>
            )}
            {label}
          </span>
          {index < STEPS.length - 1 && (
            <span className="text-muted-foreground" aria-hidden="true">
              ›
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Tally({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    neutral: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];

  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', toneClass)}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
