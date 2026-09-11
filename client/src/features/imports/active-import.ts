import type { ImportEntity } from '@/types/imports';

/**
 * The import this browser is currently watching.
 *
 * A bulk import outlives the request that started it, so the page that
 * started it is no longer where it lives. Remembering the id here — and in
 * `localStorage`, so a reload or a closed tab picks it back up — lets the
 * header follow the job from anywhere, and means only sessions that actually
 * started an import ever poll for one.
 */

const STORAGE_KEY = 'scholaris.activeImport';

export interface ActiveImport {
  importId: string;
  entity: ImportEntity;
  fileName: string;
  totalRows: number;
  /** Set once the job reaches a terminal state and the user has seen it. */
  dismissed?: boolean;
}

type Listener = (value: ActiveImport | null) => void;

function read(): ActiveImport | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveImport;
    return parsed && typeof parsed.importId === 'string' ? parsed : null;
  } catch {
    // Private browsing, cleared storage, or a half-written value: no active
    // import is a perfectly good answer.
    return null;
  }
}

function write(value: ActiveImport | null): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage being unavailable costs the user the header indicator after a
    // reload; it must not cost them the import.
  }
}

let current: ActiveImport | null = read();
const listeners = new Set<Listener>();

export const activeImport = {
  get(): ActiveImport | null {
    return current;
  },

  start(value: ActiveImport): void {
    current = value;
    write(current);
    listeners.forEach((listener) => listener(current));
  },

  clear(): void {
    current = null;
    write(null);
    listeners.forEach((listener) => listener(null));
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
