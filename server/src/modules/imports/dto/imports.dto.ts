import type {
  ImportEntityName,
  ImportJobStatus,
  ImportRowIssueRecord,
} from '../entities/importJob.entity';

/** Mirrors `client/src/types/imports.ts` — the client's copy is the contract. */

export type ImportRowIssueDTO = ImportRowIssueRecord;

export interface ImportPreviewDTO {
  importId: string;
  entity: ImportEntityName;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  duplicateRows: number;
  issues: ImportRowIssueDTO[];
  /** The first rows as they would be saved, not as they were typed. */
  preview: Record<string, string>[];
}

export interface ImportResultDTO {
  importId: string;
  entity: ImportEntityName;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  issues: ImportRowIssueDTO[];
  /** Always null: the browser builds its own report from `issues`. */
  errorReportUrl: string | null;
  completedAt: string;
}

export interface ImportJobDTO {
  id: string;
  schoolId: string;
  entity: ImportEntityName;
  fileName: string;
  status: ImportJobStatus;
  totalRows: number;
  created: number;
  failed: number;
  startedByName: string;
  startedAt: string;
  completedAt?: string;
}
