import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
import { db } from './context';

/**
 * A scheme of work is generated from a curriculum but tracked with its own
 * author, so it needs the same visibility boundary curricula already have —
 * a teacher's own schemes, plus the classes and subjects they are actually
 * assigned to teach. Nothing enforced that before: any staff member with
 * `scheme.read` saw the whole school's schemes, and `scheme.manage` let them
 * generate or edit one for any class or subject at all.
 */
const BASE = `${location.origin}/api/v1`;

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function as(email: string): RequestInit {
  return { headers: { Authorization: `Bearer mock-token:${email}` } };
}

async function call<T>(
  method: string,
  path: string,
  init: RequestInit,
  body?: unknown,
): Promise<{ status: number; data: T; message?: string }> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    method,
    headers: { ...init.headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return { status: response.status, data: undefined as T };
  const parsed = (await response.json()) as { success: boolean; data: T; message?: string };
  return { status: response.status, data: parsed.data, message: parsed.message };
}

const ADMIN = 'admin@brightfield.edu.ng';
const TEACHER = 'teacher@brightfield.edu.ng';

interface SchemeRow {
  id: string;
  classId: string;
  subjectId: string;
  createdById: string;
  curriculumId: string;
}
interface Page<T> {
  items: T[];
}
interface CurriculumRow {
  id: string;
  classId: string;
  subjectId: string;
  createdById: string;
}

async function teacherPairs(email: string): Promise<{
  userId: string;
  pairs: { classId: string; subjectId: string }[];
}> {
  const session = await call<{ user: { id: string; memberships: { staffId?: string | null }[] } }>(
    'GET',
    '/auth/session',
    as(email),
  );
  const userId = session.data.user.id;
  const staffId = session.data.user.memberships.find((entry) => entry.staffId)?.staffId;
  expect(staffId).toBeTruthy();

  const staff = await call<{ teachingAssignments: { classId: string; subjectId: string }[] }>(
    'GET',
    `/staff/${staffId}`,
    as(email),
  );
  return { userId, pairs: staff.data.teachingAssignments };
}

describe('scheme of work visibility', () => {
  it("lists only a teacher's own schemes, or ones for classes/subjects they teach", async () => {
    const { userId, pairs } = await teacherPairs(TEACHER);

    const mine = await call<Page<SchemeRow>>('GET', '/schemes?pageSize=200', as(TEACHER));
    const belongsToTeacher = (scheme: SchemeRow) =>
      scheme.createdById === userId ||
      pairs.some((pair) => pair.classId === scheme.classId && pair.subjectId === scheme.subjectId);

    expect(mine.data.items.length).toBeGreaterThan(0);
    for (const scheme of mine.data.items) expect(belongsToTeacher(scheme)).toBe(true);

    const whole = await call<Page<SchemeRow>>('GET', '/schemes?pageSize=200', as(ADMIN));
    const notTheirs = whole.data.items.filter((scheme) => !belongsToTeacher(scheme));
    expect(notTheirs.length).toBeGreaterThan(0);
    const mineIds = new Set(mine.data.items.map((scheme) => scheme.id));
    for (const scheme of notTheirs) expect(mineIds.has(scheme.id)).toBe(false);
  });

  it('refuses a teacher a scheme outside their classes, even by direct link', async () => {
    const { userId, pairs } = await teacherPairs(TEACHER);
    const belongsToTeacher = (scheme: SchemeRow) =>
      scheme.createdById === userId ||
      pairs.some((pair) => pair.classId === scheme.classId && pair.subjectId === scheme.subjectId);

    const whole = await call<Page<SchemeRow>>('GET', '/schemes?pageSize=200', as(ADMIN));
    const foreign = whole.data.items.find((scheme) => !belongsToTeacher(scheme));
    expect(foreign).toBeTruthy();

    const detail = await call('GET', `/schemes/${foreign!.id}`, as(TEACHER));
    expect(detail.status).toBe(404);

    const patch = await call('PATCH', `/schemes/${foreign!.id}`, as(TEACHER), {
      status: 'SUBMITTED',
    });
    expect(patch.status).toBe(403);
  });

  it('refuses to generate a scheme from a curriculum the teacher is not assigned to', async () => {
    const { userId, pairs } = await teacherPairs(TEACHER);

    const curricula = await call<CurriculumRow[]>('GET', '/curricula?sessionId=ALL', as(ADMIN));
    const foreign = curricula.data.find(
      (curriculum) =>
        curriculum.createdById !== userId &&
        !pairs.some(
          (pair) => pair.classId === curriculum.classId && pair.subjectId === curriculum.subjectId,
        ),
    );
    expect(foreign).toBeTruthy();

    const terms = await call<{ id: string; sessionId: string }[]>(
      'GET',
      '/academics/terms',
      as(ADMIN),
    );
    const term = terms.data[0];

    const res = await call('POST', '/schemes/generate', as(TEACHER), {
      curriculumId: foreign!.id,
      termId: term.id,
    });
    expect(res.status).toBe(403);
  });

  it('leaves a coordinator unrestricted', async () => {
    const admin = await call<Page<SchemeRow>>('GET', '/schemes?pageSize=200', as(ADMIN));
    const actualCount = db.schemes.filter((scheme) => scheme.schoolId === 'school_brightfield').length;
    expect(admin.data.items.length).toBe(actualCount);
  });
});
