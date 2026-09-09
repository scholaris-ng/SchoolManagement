import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * A plain teacher's timetable is their own classes and subjects, plus their
 * form class in full (every subject in it, not just the ones they teach) —
 * not the whole school's schedule shown by default with a filter they have
 * to remember to apply themselves. Regression coverage for exactly that gap.
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

const ADMIN = 'admin@brightfield.edu.ng';
const TEACHER = 'teacher@brightfield.edu.ng';

interface TimetableEntryRow {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
}
interface TimetableRow {
  entries: TimetableEntryRow[];
}
interface ClassRow {
  id: string;
  formTeacherId?: string | null;
}

async function teacherPairsAndFormClasses(): Promise<{
  staffId: string;
  pairs: { classId: string; subjectId: string }[];
  formClassIds: Set<string>;
}> {
  const session = await get<{ user: { memberships: { staffId?: string | null }[] } }>(
    '/auth/session',
    as(TEACHER),
  );
  const staffId = session.data.user.memberships.find((entry) => entry.staffId)?.staffId;
  expect(staffId).toBeTruthy();

  const staff = await get<{ teachingAssignments: { classId: string; subjectId: string }[] }>(
    `/staff/${staffId}`,
    as(TEACHER),
  );
  const classes = await get<ClassRow[]>('/academics/classes', as(ADMIN));
  const formClassIds = new Set(
    classes.data.filter((entry) => entry.formTeacherId === staffId).map((entry) => entry.id),
  );

  return { staffId: staffId!, pairs: staff.data.teachingAssignments, formClassIds };
}

describe("a teacher's timetable is scoped to their own load", () => {
  it('shows only entries for classes/subjects they teach, plus their form class in full', async () => {
    const { pairs, formClassIds } = await teacherPairsAndFormClasses();

    const whole = await get<TimetableRow>('/timetables/current', as(ADMIN));
    const mine = await get<TimetableRow>('/timetables/current', as(TEACHER));

    const belongsToTeacher = (entry: TimetableEntryRow) =>
      pairs.some((pair) => pair.classId === entry.classId && pair.subjectId === entry.subjectId) ||
      formClassIds.has(entry.classId);

    // Everything shown is genuinely theirs.
    for (const entry of mine.data.entries) {
      expect(belongsToTeacher(entry)).toBe(true);
    }

    // The whole-school schedule has entries that are not theirs — otherwise
    // this fixture would not actually exercise the restriction — and none of
    // those leak into their view.
    const notTheirs = whole.data.entries.filter((entry) => !belongsToTeacher(entry));
    expect(notTheirs.length).toBeGreaterThan(0);
    const mineIds = new Set(mine.data.entries.map((entry) => entry.id));
    for (const entry of notTheirs) {
      expect(mineIds.has(entry.id)).toBe(false);
    }
  });

  it('refuses an unrelated class/subject even when asked for directly by query params', async () => {
    const { pairs, formClassIds } = await teacherPairsAndFormClasses();
    const whole = await get<TimetableRow>('/timetables/current', as(ADMIN));

    const foreign = whole.data.entries.find(
      (entry) =>
        !pairs.some((pair) => pair.classId === entry.classId && pair.subjectId === entry.subjectId) &&
        !formClassIds.has(entry.classId),
    );
    expect(foreign).toBeTruthy();

    const res = await get<TimetableRow>(
      `/timetables/current?classId=${foreign!.classId}&subjectId=${foreign!.subjectId}`,
      as(TEACHER),
    );
    expect(res.status).toBe(200);
    expect(res.data.entries).toHaveLength(0);
  });

  it('still shows a coordinator (timetable.manage) the whole schedule, unfiltered by scope', async () => {
    const whole = await get<TimetableRow>('/timetables/current', as(ADMIN));
    const mine = await get<TimetableRow>('/timetables/current', as(TEACHER));

    // The admin sees strictly at least as much as the teacher, and (given the
    // seed data) genuinely more.
    expect(whole.data.entries.length).toBeGreaterThan(mine.data.entries.length);
  });
});
