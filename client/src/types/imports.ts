export type ImportEntity = 'STUDENTS' | 'GUARDIANS' | 'STAFF' | 'SUBJECTS' | 'FEES';

export interface ImportColumnDefinition {
  key: string;
  label: string;
  required: boolean;
  description?: string;
  example?: string;
}

export interface ImportSessionFile {
  fileName: string;
  sizeBytes: number;
  rowCount: number;
  /** Worksheet the rows were read from, shown in the upload summary. */
  sheetName?: string;
  headers: string[];
  sampleRows: Record<string, string>[];
}

export interface ImportMapping {
  /** Target field key -> source column header. */
  [targetKey: string]: string | null;
}

export interface ImportRowIssue {
  rowNumber: number;
  field?: string;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  value?: string;
}

export interface ImportPreview {
  importId: string;
  entity: ImportEntity;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  duplicateRows: number;
  issues: ImportRowIssue[];
  preview: Record<string, string>[];
}

/**
 * What committing answers now: the import was accepted, not finished.
 *
 * A large file takes longer than the browser will wait for a request, so the
 * server keeps working after replying and progress is followed through
 * `ImportJobDetail`.
 */
export interface ImportAccepted {
  importId: string;
  entity: ImportEntity;
  status: 'IMPORTING';
  totalRows: number;
}

/** A job being watched while it runs, and read back once it has finished. */
export interface ImportJobDetail extends ImportJob {
  processedRows: number;
  issues: ImportRowIssue[];
}

export interface ImportResult {
  importId: string;
  entity: ImportEntity;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  issues: ImportRowIssue[];
  errorReportUrl?: string | null;
  completedAt: string;
}

export interface ImportJob {
  id: string;
  schoolId: string;
  entity: ImportEntity;
  fileName: string;
  status: 'UPLOADED' | 'MAPPED' | 'VALIDATED' | 'IMPORTING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalRows: number;
  created: number;
  /** Refreshing existing records creates nothing, so counting only `created`
   * would report a successful import as having done nothing at all. */
  updated: number;
  skipped: number;
  failed: number;
  startedByName: string;
  startedAt: string;
  completedAt?: string | null;
}
