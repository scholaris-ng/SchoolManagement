import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * "Current" on `/timetables/current` means the timetable for the term that
 * is current — not merely the school's only timetable relabelled. Marking a
 * different term current used to leave this endpoint returning the same
 * timetable it always had, so the page kept showing the old term's name
 * under a header that claimed to be the new one. Its own file, not a spot in
 * academics-admin-smoke, because it mutates which term is current — a global
 * switch other tests must not see.
 */
const BASE = `${location.origin}/api/v1`;

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function as(email: string): RequestInit {
  return { headers: { Authorization: `Bearer mock-token:${email}` } };
}

async function get<T>(path: string, init: RequestInit): Promise<{ status: number; data: T }> {
  const response = await fetch(`${BASE}${path}`, init);
  const body = (await response.json()) as { success: boolean; data: T };
  return { status: response.status, data: body.data };
}

async function post(path: string, init: RequestInit): Promise<{ status: number }> {
  const response = await fetch(`${BASE}${path}`, { ...init, method: 'POST' });
  return { status: response.status };
}

const ADMIN = 'admin@brightfield.edu.ng';

describe('the timetable follows the current term', () => {
  it('is labelled for whichever term is actually current, not stuck on the seeded one', async () => {
    const before = await get<{ termName: string; name: string; termId: string }>(
      '/timetables/current',
      as(ADMIN),
    );
    expect(before.data.termName).toBe('First Term');
    const seededTermId = before.data.termId;

    const terms = await get<{ id: string; name: string; isCurrent: boolean }[]>(
      '/academics/terms',
      as(ADMIN),
    );
    const secondTerm = terms.data.find((term) => term.name === 'Second Term')!;

    await post(`/academics/terms/${secondTerm.id}/set-current`, as(ADMIN));

    // Second Term has no timetable of its own in the seed data, so the
    // honest result is "none found" — not First Term's schedule wearing
    // Second Term's label.
    const after = await get('/timetables/current', as(ADMIN));
    expect(after.status).toBe(404);

    // "Current term" is global school state, so leave it as this test found
    // it — otherwise the next test in this file starts from Second Term
    // instead of the seeded First Term.
    await post(`/academics/terms/${seededTermId}/set-current`, as(ADMIN));
  });

  it('returns the matching timetable once one exists for the newly current term', async () => {
    const terms = await get<{ id: string; isCurrent: boolean }[]>('/academics/terms', as(ADMIN));
    const original = terms.data.find((term) => term.isCurrent)!;

    // Switch away and back — the timetable seeded for the original current
    // term must still be found by its termId, not by seed order.
    const other = terms.data.find((term) => term.id !== original.id)!;
    await post(`/academics/terms/${other.id}/set-current`, as(ADMIN));
    await post(`/academics/terms/${original.id}/set-current`, as(ADMIN));

    const restored = await get<{ termId: string }>('/timetables/current', as(ADMIN));
    expect(restored.status).toBe(200);
    expect(restored.data.termId).toBe(original.id);
  });
});
