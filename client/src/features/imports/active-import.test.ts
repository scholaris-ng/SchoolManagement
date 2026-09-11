import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveImport } from './active-import';

/**
 * The import being watched has to outlive the page that started it — that is
 * the whole point of handing the file over and carrying on working — so it
 * lives in storage rather than in component state.
 */

const STORAGE_KEY = 'scholaris.activeImport';

const record: ActiveImport = {
  importId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  entity: 'STAFF',
  fileName: 'staff.xlsx',
  totalRows: 120,
};

async function freshModule() {
  vi.resetModules();
  return import('./active-import');
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('activeImport', () => {
  it('starts with nothing to watch', async () => {
    const { activeImport } = await freshModule();
    expect(activeImport.get()).toBeNull();
  });

  it('remembers the import across a reload', async () => {
    const first = await freshModule();
    first.activeImport.start(record);

    // A new module instance stands in for the page being loaded again.
    const second = await freshModule();
    expect(second.activeImport.get()).toEqual(record);
  });

  it('tells subscribers when an import starts and when it is cleared', async () => {
    const { activeImport } = await freshModule();
    const seen: (ActiveImport | null)[] = [];
    const unsubscribe = activeImport.subscribe((value) => seen.push(value));

    activeImport.start(record);
    activeImport.clear();
    unsubscribe();
    activeImport.start(record);

    expect(seen).toEqual([record, null]);
  });

  it('forgets the import once it is cleared', async () => {
    const { activeImport } = await freshModule();
    activeImport.start(record);
    activeImport.clear();

    expect(activeImport.get()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('treats unreadable storage as nothing to watch rather than throwing', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json');
    const { activeImport } = await freshModule();
    expect(activeImport.get()).toBeNull();
  });
});
