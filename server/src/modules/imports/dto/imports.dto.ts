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

/** What `POST /imports/commit` answers now that the work outlives the request. */
export interface ImportAcceptedDTO {
  importId: string;
  entity: ImportEntityName;
  status: 'IMPORTING';
  totalRows: number;
}

/** `GET /imports/:id` — what the header polls while an import runs. */
export interface ImportJobDetailDTO extends ImportJobDTO {
  processedRows: number;
  issues: ImportRowIssueDTO[];
}

export interface ImportJobDTO {
  id: string;
  schoolId: string;
  entity: ImportEntityName;
  fileName: string;
  status: ImportJobStatus;
  totalRows: number;
  created: number;
  /** An import that only refreshes existing records creates nothing — the
   * history has to count these too, or it reads as though nothing happened. */
  updated: number;
  skipped: number;
  failed: number;
  startedByName: string;
  startedAt: string;
  completedAt?: string;
}
