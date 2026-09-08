import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The "Clear timetable" button wipes every entry in one call rather than the
 * client looping over individual deletes — this exercises that endpoint
 * directly. It gets its own file, not a spot in academics-admin-smoke, so
 * wiping the seeded timetable here can never run before another test that
 * still expects it to have entries in it.
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

async function del<T>(path: string, init: RequestInit): Promise<{ status: number; data: T }> {
  const response = await fetch(`${BASE}${path}`, { ...init, method: 'DELETE' });
  const body = (await response.json()) as { success: boolean; data: T };
  return { status: response.status, data: body.data };
}

const ADMIN = 'admin@brightfield.edu.ng';
const STUDENT = 'student@brightfield.edu.ng';

describe('clearing the whole timetable', () => {
  it('removes every entry regardless of the current filters', async () => {
    const before = await get<{ id: string; entries: unknown[] }>('/timetables/current', as(ADMIN));
    expect(before.data.entries.length).toBeGreaterThan(0);

    const cleared = await del<{ removed: number }>(
      `/timetables/${before.data.id}/entries`,
      as(ADMIN),
    );
    expect(cleared.status).toBe(200);
    expect(cleared.data.removed).toBe(before.data.entries.length);

    const after = await get<{ entries: unknown[] }>('/timetables/current', as(ADMIN));
    expect(after.data.entries).toEqual([]);

    // The periods themselves — the school day's shape — are untouched.
    const afterWithPeriods = await get<{ periods: unknown[] }>('/timetables/current', as(ADMIN));
    expect(afterWithPeriods.data.periods.length).toBeGreaterThan(0);
  });

  it('refuses a student, and leaves the timetable untouched', async () => {
    const before = await get<{ id: string; entries: unknown[] }>('/timetables/current', as(ADMIN));

    const refused = await del(`/timetables/${before.data.id}/entries`, as(STUDENT));
    expect(refused.status).toBe(403);

    const after = await get<{ entries: unknown[] }>('/timetables/current', as(ADMIN));
    expect(after.data.entries.length).toBe(before.data.entries.length);
  });
});
