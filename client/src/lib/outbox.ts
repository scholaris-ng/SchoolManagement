import { ApiError, isApiError } from './api-error';
import { localStore, storageKeys } from './storage';
import { send, createId } from './outbox-transport';
import { MAX_ATTEMPTS } from './outbox.types';
import type { InvalidateFn, Listener, OutboxEntry, OutboxState } from './outbox.types';

export type {
  InvalidateFn,
  Listener,
  OutboxEntry,
  OutboxEntryStatus,
  OutboxState,
} from './outbox.types';

/**
 * Offline mutation outbox (spec section 39).
 *
 * Two rules keep this honest:
 *   1. A queued item is never reported to the user as "saved". Its state is
 *      `pending` until the server acknowledges it.
 *   2. Every entry carries an idempotency key so replay after an ambiguous
 *      failure cannot double-post a payment or duplicate a register.
 */
class Outbox {
  private entries: OutboxEntry[] = [];
  private listeners = new Set<Listener>();
  private flushing = false;
  private online = typeof navigator === 'undefined' ? true : navigator.onLine;
  private invalidate: InvalidateFn = () => {};
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.entries = localStore.get<OutboxEntry[]>(storageKeys.outbox, []).map((entry) => ({
      ...entry,
      // Anything mid-flight when the tab closed is retryable, not lost.
      status: entry.status === 'sending' ? 'pending' : entry.status,
    }));
  }

  /** Wired up once, at app start, so the outbox stays free of React imports. */
  attach(options: { invalidate: InvalidateFn }): () => void {
    this.invalidate = options.invalidate;

    const handleOnline = () => {
      this.online = true;
      this.publish();
      void this.flush();
    };
    const handleOffline = () => {
      this.online = false;
      this.publish();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (this.online) void this.flush();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (this.retryTimer) clearTimeout(this.retryTimer);
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): OutboxState {
    return { entries: [...this.entries], isOnline: this.online, isFlushing: this.flushing };
  }

  get pendingCount(): number {
    return this.entries.filter((e) => e.status !== 'conflict').length;
  }

  /**
   * Queue a mutation. `dedupeKey` collapses repeated edits to the same target
   * (re-marking the same register) so a flaky morning does not produce fifty
   * queued writes for one class.
   */
  enqueue(input: {
    label: string;
    method: OutboxEntry['method'];
    path: string;
    body?: unknown;
    invalidate?: string[][];
    schoolId?: string | null;
    dedupeKey?: string;
  }): OutboxEntry {
    const entry: OutboxEntry = {
      id: input.dedupeKey ?? createId(),
      label: input.label,
      method: input.method,
      path: input.path,
      body: input.body,
      idempotencyKey: createId(),
      invalidate: input.invalidate ?? [],
      schoolId: input.schoolId ?? null,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
    };

    const existingIndex = this.entries.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) {
      // Keep the original idempotency key so a partially-delivered write is
      // recognised by the server rather than applied twice.
      entry.idempotencyKey = this.entries[existingIndex].idempotencyKey;
      this.entries[existingIndex] = entry;
    } else {
      this.entries.push(entry);
    }

    this.persist();
    void this.flush();
    return entry;
  }

  discard(id: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== id);
    this.persist();
  }

  clearConflicts(): void {
    this.entries = this.entries.filter((entry) => entry.status !== 'conflict');
    this.persist();
  }

  retryNow(): void {
    this.entries = this.entries.map((entry) =>
      entry.status === 'failed' ? { ...entry, status: 'pending', attempts: 0 } : entry,
    );
    this.persist();
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.online) return;
    const queue = this.entries.filter((entry) => entry.status === 'pending');
    if (queue.length === 0) return;

    this.flushing = true;
    this.publish();

    for (const entry of queue) {
      this.update(entry.id, { status: 'sending' });
      try {
        await send(entry);
        this.entries = this.entries.filter((e) => e.id !== entry.id);
        this.persist();
        if (entry.invalidate.length > 0) this.invalidate(entry.invalidate);
      } catch (error) {
        this.handleFailure(entry, error);
        // A dropped connection means the rest of the queue will fail too.
        if (isApiError(error) && error.isOffline) break;
      }
    }

    this.flushing = false;
    this.publish();
    this.scheduleRetry();
  }

  private handleFailure(entry: OutboxEntry, error: unknown): void {
    const attempts = entry.attempts + 1;

    if (isApiError(error)) {
      const apiError = error as ApiError;
      if (apiError.isVersionConflict) {
        // Someone else changed the record first. This needs a human decision,
        // so it stops here rather than silently overwriting their work.
        this.update(entry.id, {
          status: 'conflict',
          attempts,
          lastError: apiError.message,
        });
        return;
      }
      if (!apiError.isRetryable) {
        this.update(entry.id, { status: 'failed', attempts, lastError: apiError.message });
        return;
      }
    }

    this.update(entry.id, {
      status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      attempts,
      lastError: error instanceof Error ? error.message : 'Sync failed',
    });
  }

  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const retryable = this.entries.filter((entry) => entry.status === 'pending');
    if (retryable.length === 0 || !this.online) return;
    const attempts = Math.min(...retryable.map((entry) => entry.attempts));
    const delay = Math.min(2000 * 2 ** attempts, 60_000);
    this.retryTimer = setTimeout(() => void this.flush(), delay);
  }

  private update(id: string, patch: Partial<OutboxEntry>): void {
    this.entries = this.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
    this.persist();
  }

  private persist(): void {
    localStore.set(storageKeys.outbox, this.entries);
    this.publish();
  }

  private publish(): void {
    const state = this.snapshot();
    this.listeners.forEach((listener) => listener(state));
  }
}

export const outbox = new Outbox();
