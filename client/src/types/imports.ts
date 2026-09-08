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
  failed: number;
  startedByName: string;
  startedAt: string;
  completedAt?: string | null;
}
