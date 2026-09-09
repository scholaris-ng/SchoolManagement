import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
import { db } from './context';

/**
 * Every class and subject picker in the app is built from these two endpoints,
 * so what they return *is* what the dropdowns offer. A teacher being shown a
 * class they cannot act on is the bug these cover.
 */
const BASE = `${location.origin}/api/v1`;

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function as(email: string): RequestInit {
  return { headers: { Authorization: `Bearer mock-token:${email}` } };
}

async function get<T>(path: string, email: string): Promise<{ status: number; data: T }> {
  const response = await fetch(`${BASE}${path}`, as(email));
  const parsed = (await response.json()) as { data: T };
  return { status: response.status, data: parsed.data };
}

const ADMIN = 'admin@brightfield.edu.ng';
const TEACHER = 'teacher@brightfield.edu.ng';
const BURSAR = 'bursar@brightfield.edu.ng';
const PARENT = 'parent@example.com';

interface Row {
  id: string;
  name: string;
  levelId?: string;
}

describe('class and subject pickers', () => {
  it('offers a teacher only the classes and subjects they are assigned', async () => {
    const staff = db.staff.find((member) => member.email === TEACHER)!;

    const classes = await get<Row[]>('/academics/classes', TEACHER);
    const subjects = await get<Row[]>('/academics/subjects', TEACHER);

    expect(classes.data.length).toBeGreaterThan(0);
    expect(subjects.data.length).toBeGreaterThan(0);

    // Their teaching list, plus any class they are form teacher of.
    const allowed = new Set([
      ...staff.classIds,
      ...db.classes.filter((entry) => entry.formTeacherId === staff.id).map((entry) => entry.id),
    ]);
    for (const row of classes.data) expect(allowed.has(row.id)).toBe(true);
    for (const row of subjects.data) expect(staff.subjectIds).toContain(row.id);

    // And genuinely narrower than the whole school.
    const allClasses = await get<Row[]>('/academics/classes', ADMIN);
    expect(classes.data.length).toBeLessThan(allClasses.data.length);
  });

  it('offers only the levels those classes sit in', async () => {
    const classes = await get<Row[]>('/academics/classes', TEACHER);
    const levels = await get<Row[]>('/academics/levels', TEACHER);

    const taughtLevelIds = new Set(classes.data.map((row) => row.levelId));
    for (const level of levels.data) expect(taughtLevelIds.has(level.id)).toBe(true);
  });

  it('refuses a teacher a class outside their assignment, rather than 403ing', async () => {
    const mine = await get<Row[]>('/academics/classes', TEACHER);
    const all = await get<Row[]>('/academics/classes', ADMIN);
    const mineIds = new Set(mine.data.map((row) => row.id));
    const foreign = all.data.find((row) => !mineIds.has(row.id))!;

    const response = await fetch(`${BASE}/academics/classes/${foreign.id}`, as(TEACHER));
    expect(response.status).toBe(404);
  });

  it('leaves whole-school roles unrestricted', async () => {
    const all = await get<Row[]>('/academics/classes', ADMIN);
    // A bursar chases fees across every class, so their picker must not shrink.
    const bursar = await get<Row[]>('/academics/classes', BURSAR);
    expect(bursar.data.length).toBe(all.data.length);
  });

  it("gives a parent only their own children's classes", async () => {
    const all = await get<Row[]>('/academics/classes', ADMIN);
    const parent = await get<Row[]>('/academics/classes', PARENT);

    expect(parent.data.length).toBeGreaterThan(0);
    expect(parent.data.length).toBeLessThan(all.data.length);

    const guardianId = db.users
      .find((user) => user.email === PARENT)!
      .memberships[0].guardianId!;
    const childClassIds = new Set(
      db.studentGuardians
        .filter((link) => link.guardianId === guardianId)
        .map((link) => db.students.find((student) => student.id === link.studentId)?.currentClassId),
    );
    for (const row of parent.data) expect(childClassIds.has(row.id)).toBe(true);
  });

  it('narrows subjects to a named class', async () => {
    const classes = await get<Row[]>('/academics/classes', ADMIN);
    const schoolClass = classes.data[0];

    const forClass = await get<Row[]>(`/academics/subjects?classId=${schoolClass.id}`, ADMIN);
    const forLevel = await get<Row[]>(
      `/academics/subjects?levelId=${schoolClass.levelId}`,
      ADMIN,
    );
    expect(forClass.data.map((row) => row.id)).toEqual(forLevel.data.map((row) => row.id));
  });
});
