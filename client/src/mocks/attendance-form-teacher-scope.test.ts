import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The daily register is the form teacher's job, not every teacher who
 * passes through the room over the week — a subject teacher who can see a
 * class's curriculum should not thereby see, or mark, its attendance. This
 * exercises the class-level restriction directly against the handlers,
 * since `attendance.read`/`attendance.manage` alone (the permission a
 * regular teacher already holds) used to be the only gate.
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

async function post<T>(
  path: string,
  body: unknown,
  init: RequestInit,
): Promise<{ status: number; data: T }> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    method: 'POST',
    headers: { ...init.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json()) as { success: boolean; data: T };
  return { status: response.status, data: parsed.data };
}

const ADMIN = 'admin@brightfield.edu.ng';
const TEACHER = 'teacher@brightfield.edu.ng';

describe('attendance is scoped to the form teacher, not every teacher', () => {
  it('offers only the teacher’s own form class in the register class picker', async () => {
    const allClasses = await get<{ id: string }[]>('/academics/classes', as(ADMIN));
    const myFormClasses = await get<{ id: string; formTeacherId: string | null }[]>(
      '/academics/classes?formTeacherOnly=true',
      as(TEACHER),
    );

    expect(myFormClasses.data.length).toBeGreaterThan(0);
    expect(myFormClasses.data.length).toBeLessThan(allClasses.data.length);
  });

  it('lets the form teacher view and mark their own class', async () => {
    const myFormClasses = await get<{ id: string }[]>(
      '/academics/classes?formTeacherOnly=true',
      as(TEACHER),
    );
    const ownClassId = myFormClasses.data[0].id;

    const register = await get<{ classId: string }>(
      `/attendance/register?classId=${ownClassId}`,
      as(TEACHER),
    );
    expect(register.status).toBe(200);

    const saved = await post(
      '/attendance/register',
      { classId: ownClassId, date: '2026-09-08', marks: [] },
      as(TEACHER),
    );
    expect(saved.status).toBe(200);
  });

  it('refuses a class the teacher is not the form teacher of, on every attendance endpoint', async () => {
    const allClasses = await get<{ id: string }[]>('/academics/classes', as(ADMIN));
    const myFormClasses = await get<{ id: string }[]>(
      '/academics/classes?formTeacherOnly=true',
      as(TEACHER),
    );
    const myFormClassIds = new Set(myFormClasses.data.map((c) => c.id));
    const someoneElsesClass = allClasses.data.find((c) => !myFormClassIds.has(c.id));
    expect(someoneElsesClass).toBeTruthy();
    const otherClassId = someoneElsesClass!.id;

    const register = await get(`/attendance/register?classId=${otherClassId}`, as(TEACHER));
    expect(register.status).toBe(404);

    const saved = await post(
      '/attendance/register',
      { classId: otherClassId, date: '2026-09-08', marks: [] },
      as(TEACHER),
    );
    expect(saved.status).toBe(404);

    const summary = await get(`/attendance/summary?classId=${otherClassId}`, as(TEACHER));
    expect(summary.status).toBe(404);

    const trend = await get(`/attendance/trend?classId=${otherClassId}`, as(TEACHER));
    expect(trend.status).toBe(404);
  });

  it('excludes classes the teacher does not own from the whole-school summary and trend', async () => {
    const allClasses = await get<{ id: string }[]>('/academics/classes', as(ADMIN));
    const myFormClasses = await get<{ id: string }[]>(
      '/academics/classes?formTeacherOnly=true',
      as(TEACHER),
    );
    const myFormClassIds = new Set(myFormClasses.data.map((c) => c.id));
    const othersClassIds = new Set(
      allClasses.data.filter((c) => !myFormClassIds.has(c.id)).map((c) => c.id),
    );

    const summary = await get<{ classId: string }[]>('/attendance/summary', as(TEACHER));
    expect(summary.data.some((row) => othersClassIds.has(row.classId))).toBe(false);
  });

  it('leaves an administrator unrestricted', async () => {
    const allClasses = await get<{ id: string }[]>('/academics/classes', as(ADMIN));
    const scoped = await get<{ id: string }[]>('/academics/classes?formTeacherOnly=true', as(ADMIN));
    expect(scoped.data.length).toBe(allClasses.data.length);

    const anyClassId = allClasses.data[0].id;
    const register = await get(`/attendance/register?classId=${anyClassId}`, as(ADMIN));
    expect(register.status).toBe(200);
  });
});
