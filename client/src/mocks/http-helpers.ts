import { HttpResponse } from 'msw';
import type { PageMeta } from '@/types/api';

/** Mirrors the success/failure envelopes the Express API is specified to emit. */
export function ok<T>(data: T, message?: string) {
  return HttpResponse.json({ success: true, data, message });
}

export function created<T>(data: T, message?: string) {
  return HttpResponse.json({ success: true, data, message }, { status: 201 });
}

export function noContent() {
  return new HttpResponse(null, { status: 204 });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: { field?: string; message: string }[],
) {
  return HttpResponse.json({ success: false, error: { code, message, details } }, { status });
}

export const errors = {
  unauthenticated: () => fail(401, 'UNAUTHENTICATED', 'You are not signed in.'),
  forbidden: (message = 'You do not have permission to do that.') =>
    fail(403, 'FORBIDDEN', message),
  notFound: (what = 'Record') => fail(404, 'NOT_FOUND', `${what} was not found.`),
  validation: (message: string, details?: { field?: string; message: string }[]) =>
    fail(422, 'VALIDATION_ERROR', message, details),
  conflict: (message: string) => fail(409, 'CONFLICT', message),
  versionConflict: () =>
    fail(
      409,
      'VERSION_CONFLICT',
      'Someone else changed this record while you were editing it.',
    ),
};

export function paginate<T>(items: T[], page = 1, pageSize = 25): { items: T[]; meta: PageMeta } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    meta: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrevious: safePage > 1,
    },
  };
}

export function readListParams(url: URL) {
  return {
    page: Number(url.searchParams.get('page') ?? 1),
    pageSize: Number(url.searchParams.get('pageSize') ?? 25),
    search: (url.searchParams.get('search') ?? '').trim().toLowerCase(),
    sortBy: url.searchParams.get('sortBy') ?? undefined,
    sortDir: (url.searchParams.get('sortDir') ?? 'asc') as 'asc' | 'desc',
  };
}

export function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  sortBy: string | undefined,
  sortDir: 'asc' | 'desc',
): T[] {
  if (!sortBy) return rows;
  const factor = sortDir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    return String(left).localeCompare(String(right)) * factor;
  });
}

export function matchesSearch(haystacks: (string | null | undefined)[], needle: string): boolean {
  if (!needle) return true;
  return haystacks.some((value) => value?.toLowerCase().includes(needle));
}

/** Simulates a slow Nigerian connection so loading states are actually seen. */
export function latency(): number {
  return 120 + Math.random() * 260;
}
