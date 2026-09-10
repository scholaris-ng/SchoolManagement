/**
 * Shapes of the offline mutation outbox (spec section 39).
 *
 * Nigerian schools lose connectivity and power routinely, and the workflows
 * that suffer most — attendance, score entry, exam answers — are exactly the
 * ones a teacher cannot simply redo. Mutations are therefore persisted to disk
 * the moment they are attempted and replayed when the network returns.
 */

export type OutboxEntryStatus = 'pending' | 'sending' | 'failed' | 'conflict';

export interface OutboxEntry {
  id: string;
  /** Human label shown in the sync tray, e.g. "Attendance — JSS 1A, 12 May". */
  label: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey: string;
  /** Query keys to invalidate once this entry succeeds. */
  invalidate: string[][];
  schoolId: string | null;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: OutboxEntryStatus;
}

export interface OutboxState {
  entries: OutboxEntry[];
  isOnline: boolean;
  isFlushing: boolean;
}

export type Listener = (state: OutboxState) => void;
export type InvalidateFn = (keys: string[][]) => void;

/** Retries before an entry is parked as `failed` for the user to resolve. */
export const MAX_ATTEMPTS = 8;
