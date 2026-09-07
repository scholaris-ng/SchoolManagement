import { useCallback, useEffect, useMemo, useState } from 'react';
import { localStore, storageKeys } from '@/lib/storage';
import type { ParentChildSummary } from '@/types/analytics';

export interface ActiveChildState {
  children: ParentChildSummary[];
  activeChild: ParentChildSummary | null;
  activeChildId: string | null;
  setActiveChildId: (studentId: string) => void;
  hasMultiple: boolean;
}

/**
 * Which child a parent is currently looking at.
 *
 * A guardian signs in once and sees every child they are linked to (spec
 * section 8), so almost every parent screen needs the same "which one?"
 * answer. The choice is remembered between visits, and re-validated against
 * the list the server returned — a child who has left the school must not keep
 * driving the portal.
 */
export function useActiveChild(children: ParentChildSummary[] | undefined): ActiveChildState {
  const list = useMemo(() => children ?? [], [children]);
  const [storedId, setStoredId] = useState<string | null>(() =>
    localStore.get<string | null>(storageKeys.activeChild, null),
  );

  useEffect(() => {
    if (list.length === 0) return;
    if (!list.some((child) => child.studentId === storedId)) {
      const fallback = list[0].studentId;
      localStore.set(storageKeys.activeChild, fallback);
      setStoredId(fallback);
    }
  }, [list, storedId]);

  const setActiveChildId = useCallback((studentId: string) => {
    localStore.set(storageKeys.activeChild, studentId);
    setStoredId(studentId);
  }, []);

  const activeChild = list.find((child) => child.studentId === storedId) ?? list[0] ?? null;

  return {
    children: list,
    activeChild,
    activeChildId: activeChild?.studentId ?? null,
    setActiveChildId,
    hasMultiple: list.length > 1,
  };
}
