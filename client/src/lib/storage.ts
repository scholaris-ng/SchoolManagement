/**
 * Namespaced, failure-tolerant wrappers around Web Storage.
 *
 * Private windows, cleared site data and storage-blocking browsers all make
 * these calls throw, so every access is guarded and the caller always gets a
 * usable value back.
 */
const PREFIX = 'scholaris';

function key(name: string): string {
  return `${PREFIX}:${name}`;
}

export const localStore = {
  get<T>(name: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key(name));
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(name: string, value: unknown): void {
    try {
      window.localStorage.setItem(key(name), JSON.stringify(value));
    } catch {
      /* Quota exceeded or storage disabled — a lost preference is acceptable. */
    }
  },
  remove(name: string): void {
    try {
      window.localStorage.removeItem(key(name));
    } catch {
      /* no-op */
    }
  },
  /** Removes every key under a prefix, e.g. all drafts for one class. */
  removeByPrefix(prefix: string): void {
    try {
      const full = key(prefix);
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(full)) doomed.push(k);
      }
      doomed.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* no-op */
    }
  },
};

export const sessionStore = {
  get<T>(name: string, fallback: T): T {
    try {
      const raw = window.sessionStorage.getItem(key(name));
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(name: string, value: unknown): void {
    try {
      window.sessionStorage.setItem(key(name), JSON.stringify(value));
    } catch {
      /* no-op */
    }
  },
  remove(name: string): void {
    try {
      window.sessionStorage.removeItem(key(name));
    } catch {
      /* no-op */
    }
  },
};

export const storageKeys = {
  activeSchoolId: 'active-school-id',
  theme: 'theme',
  sidebarCollapsed: 'sidebar-collapsed',
  mockPersona: 'mock-persona',
  outbox: 'outbox',
  attendanceDraft: (classId: string, date: string) => `draft:attendance:${classId}:${date}`,
  scoreDraft: (scoreSheetId: string) => `draft:scores:${scoreSheetId}`,
  admissionApplicationDraft: (slug: string) => `draft:admission-application:${slug}`,
  cbtAttempt: (attemptId: string) => `cbt:attempt:${attemptId}`,
  activeChild: 'active-child-id',
} as const;
