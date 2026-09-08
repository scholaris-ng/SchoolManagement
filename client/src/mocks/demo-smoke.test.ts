import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * Smoke test for the demo deployment.
 *
 * A demo build has no backend: the mock API *is* the backend. These checks run
 * the very same handlers under Node, so a broken demo is caught here rather
 * than by someone clicking a persona on a published URL and getting a 404.
 *
 * The second school is deliberately included — a demo that leaked one school's
 * records into another's would be worse than no demo at all.
 */
// The handlers register relative paths, which MSW resolves against the
// document origin — so requests have to be made against that same origin.
const BASE = `${location.origin}/api/v1`;

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function as(email: string, schoolId?: string): RequestInit {
  const headers: Record<string, string> = { Authorization: `Bearer mock-token:${email}` };
  if (schoolId) headers['X-School-Id'] = schoolId;
  return { headers };
}

async function get<T>(path: string, init: RequestInit): Promise<{ status: number; data: T }> {
  const response = await fetch(`${BASE}${path}`, init);
  const body = (await response.json()) as { success: boolean; data: T };
  return { status: response.status, data: body.data };
}

describe('demo API', () => {
  it('refuses a request with no session', async () => {
    const response = await fetch(`${BASE}/auth/session`);
    expect(response.status).toBe(401);
  });

  it('signs in each persona and returns their memberships', async () => {
    const personas = [
      'admin@brightfield.edu.ng',
      'principal@brightfield.edu.ng',
      'teacher@brightfield.edu.ng',
      'bursar@brightfield.edu.ng',
      'parent@example.com',
      'student@brightfield.edu.ng',
      'admin@rivercrest.edu.ng',
    ];

    for (const email of personas) {
      const { status, data } = await get<{
        user: { email: string; memberships: { schoolId: string; permissions: string[] }[] };
      }>('/auth/session', as(email));

      expect(status, `${email} could not sign in`).toBe(200);
      expect(data.user.email).toBe(email);
      expect(data.user.memberships.length, `${email} has no membership`).toBeGreaterThan(0);
      expect(data.user.memberships[0].permissions.length).toBeGreaterThan(0);
    }
  });

  it('serves the dashboards each persona lands on', async () => {
    const cases: [string, string][] = [
      ['admin@brightfield.edu.ng', '/dashboard/admin'],
      ['teacher@brightfield.edu.ng', '/dashboard/teacher'],
      ['bursar@brightfield.edu.ng', '/dashboard/bursar'],
      ['parent@example.com', '/dashboard/parent'],
      ['student@brightfield.edu.ng', '/dashboard/student'],
    ];

    for (const [email, path] of cases) {
      const { status } = await get(path, as(email));
      expect(status, `${path} failed for ${email}`).toBe(200);
    }
  });

  it('gives the parent every child linked to them', async () => {
    const { data } = await get<{ children: { fullName: string }[] }>(
      '/dashboard/parent',
      as('parent@example.com'),
    );
    expect(data.children.length).toBeGreaterThan(1);
  });

  it('returns seeded students, invoices and results for the admin', async () => {
    for (const path of ['/students', '/invoices', '/score-sheets', '/admissions']) {
      const { status, data } = await get<{ items: unknown[] }>(
        path,
        as('admin@brightfield.edu.ng'),
      );
      expect(status, `${path} failed`).toBe(200);
      expect(data.items.length, `${path} returned nothing to demo`).toBeGreaterThan(0);
    }
  });

  it('refuses a persona the permissions they do not hold', async () => {
    // A student has no business reading the audit trail.
    const response = await fetch(`${BASE}/audit`, as('student@brightfield.edu.ng'));
    expect(response.status).toBe(403);
  });

  it('never leaks one school into another', async () => {
    const brightfield = await get<{ items: { schoolId: string }[] }>(
      '/students',
      as('admin@brightfield.edu.ng'),
    );
    const rivercrest = await get<{ items: { schoolId: string }[] }>(
      '/students',
      as('admin@rivercrest.edu.ng'),
    );

    const brightfieldIds = new Set(brightfield.data.items.map((row) => row.schoolId));
    const rivercrestIds = new Set(rivercrest.data.items.map((row) => row.schoolId));

    expect(brightfieldIds.size).toBe(1);
    expect(rivercrestIds.size).toBe(1);
    expect([...brightfieldIds][0]).not.toBe([...rivercrestIds][0]);
  });

  it('ignores a school id the user has no membership in', async () => {
    // The tenant comes from the session, never from the header alone.
    const honest = await get<{ user: unknown }>(
      '/auth/session',
      as('admin@rivercrest.edu.ng'),
    );
    const forged = await get<{ activeSchoolId: string }>(
      '/auth/session',
      as('admin@rivercrest.edu.ng', 'sch_someone_elses'),
    );

    expect(honest.status).toBe(200);
    const students = await get<{ items: { schoolId: string }[] }>(
      '/students',
      as('admin@rivercrest.edu.ng', 'sch_someone_elses'),
    );
    // Falls back to their own membership rather than honouring the header.
    expect(new Set(students.data.items.map((row) => row.schoolId)).size).toBe(1);
    expect(forged.data.activeSchoolId).not.toBe('sch_someone_elses');
  });
});
