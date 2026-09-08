import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The Academic setup screen (Sessions & terms, Periods) has no real backend
 * yet — the mock API is it, same as the rest of the demo (see demo-smoke).
 * This exercises the handlers behind those two tabs end to end: creating a
 * session with its terms, editing a term, and adding a period that the
 * timetable — which reads its own copy of the period list — picks up too.
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

async function send<T>(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
  init: RequestInit,
): Promise<{ status: number; data: T; message?: string }> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    method,
    headers: { ...init.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json()) as { success: boolean; data: T; message?: string };
  return { status: response.status, data: parsed.data, message: parsed.message };
}

async function del(path: string, init: RequestInit): Promise<{ status: number }> {
  const response = await fetch(`${BASE}${path}`, { ...init, method: 'DELETE' });
  return { status: response.status };
}

const ADMIN = 'admin@brightfield.edu.ng';
const STUDENT = 'student@brightfield.edu.ng';

describe('academic setup admin API', () => {
  it('creates a session with its terms in one call, and lists both afterwards', async () => {
    const create = await send<{ id: string; name: string }>(
      'POST',
      '/academics/sessions',
      {
        name: '2030/2031',
        startDate: '2030-09-09',
        endDate: '2031-07-18',
        terms: [
          { name: 'First Term', startDate: '2030-09-09', endDate: '2030-12-13', teachingWeeks: 13 },
          { name: 'Second Term', startDate: '2031-01-06', endDate: '2031-04-04', teachingWeeks: 13 },
          { name: 'Third Term', startDate: '2031-04-22', endDate: '2031-07-18', teachingWeeks: 13 },
        ],
      },
      as(ADMIN),
    );
    expect(create.status).toBe(201);
    expect(create.data.name).toBe('2030/2031');

    const sessions = await get<{ id: string; name: string }[]>('/academics/sessions', as(ADMIN));
    expect(sessions.data.some((session) => session.id === create.data.id)).toBe(true);

    const terms = await get<{ sessionId: string; name: string }[]>('/academics/terms', as(ADMIN));
    const ownTerms = terms.data.filter((term) => term.sessionId === create.data.id);
    expect(ownTerms.map((term) => term.name)).toEqual(['First Term', 'Second Term', 'Third Term']);
  });

  it('renames a session and updates its terms display name to match', async () => {
    const create = await send<{ id: string }>(
      'POST',
      '/academics/sessions',
      {
        name: 'Draft session',
        startDate: '2031-09-08',
        endDate: '2032-07-16',
        terms: [{ name: 'First Term', startDate: '2031-09-08', endDate: '2031-12-12', teachingWeeks: 13 }],
      },
      as(ADMIN),
    );

    await send('PATCH', `/academics/sessions/${create.data.id}`, { name: '2031/2032' }, as(ADMIN));

    const terms = await get<{ sessionId: string; sessionName: string }[]>(
      '/academics/terms',
      as(ADMIN),
    );
    const own = terms.data.find((term) => term.sessionId === create.data.id);
    expect(own?.sessionName).toBe('2031/2032');
  });

  it('adds a standalone term to an existing session and edits it afterwards', async () => {
    const sessions = await get<{ id: string }[]>('/academics/sessions', as(ADMIN));
    const sessionId = sessions.data[0].id;

    const addTerm = await send<{ id: string; sequence: number }>(
      'POST',
      '/academics/terms',
      { sessionId, name: 'Holiday catch-up', startDate: '2031-08-01', endDate: '2031-08-14', teachingWeeks: 2 },
      as(ADMIN),
    );
    expect(addTerm.status).toBe(201);

    const edit = await send<{ teachingWeeks: number }>(
      'PATCH',
      `/academics/terms/${addTerm.data.id}`,
      { teachingWeeks: 3 },
      as(ADMIN),
    );
    expect(edit.data.teachingWeeks).toBe(3);
  });

  it('adds a period and the current timetable picks it up without a separate step', async () => {
    const before = await get<{ periods: { id: string }[] }>('/timetables/current', as(ADMIN));
    const beforeCount = before.data.periods.length;

    const create = await send<{ id: string; name: string; sequence: number }>(
      'POST',
      '/academics/periods',
      { name: 'Period 9', startTime: '14:20', endTime: '15:00', isBreak: false },
      as(ADMIN),
    );
    expect(create.status).toBe(201);

    const periods = await get<{ id: string }[]>('/academics/periods', as(ADMIN));
    expect(periods.data.some((period) => period.id === create.data.id)).toBe(true);

    const after = await get<{ periods: { id: string }[] }>('/timetables/current', as(ADMIN));
    expect(after.data.periods).toHaveLength(beforeCount + 1);
    expect(after.data.periods.some((period) => period.id === create.data.id)).toBe(true);
  });

  it('edits a period in place', async () => {
    const periods = await get<{ id: string }[]>('/academics/periods', as(ADMIN));
    const target = periods.data[0].id;

    const edit = await send<{ name: string; isBreak: boolean }>(
      'PATCH',
      `/academics/periods/${target}`,
      { name: 'Assembly', isBreak: true },
      as(ADMIN),
    );
    expect(edit.status).toBe(200);
    expect(edit.data).toMatchObject({ name: 'Assembly', isBreak: true });
  });

  it('refuses a student trying to write to sessions, terms or periods', async () => {
    const session = await send('POST', '/academics/sessions', { name: 'x' }, as(STUDENT));
    const term = await send('POST', '/academics/terms', { sessionId: 'x' }, as(STUDENT));
    const period = await send('POST', '/academics/periods', { name: 'x' }, as(STUDENT));

    expect(session.status).toBe(403);
    expect(term.status).toBe(403);
    expect(period.status).toBe(403);
  });

  it('deletes a session and its terms with it, but refuses to delete the current one', async () => {
    const create = await send<{ id: string }>(
      'POST',
      '/academics/sessions',
      {
        name: 'Disposable session',
        startDate: '2032-09-06',
        endDate: '2033-07-15',
        terms: [{ name: 'First Term', startDate: '2032-09-06', endDate: '2032-12-10', teachingWeeks: 13 }],
      },
      as(ADMIN),
    );

    const removed = await del(`/academics/sessions/${create.data.id}`, as(ADMIN));
    expect(removed.status).toBe(204);

    const sessions = await get<{ id: string; isCurrent: boolean }[]>('/academics/sessions', as(ADMIN));
    expect(sessions.data.some((session) => session.id === create.data.id)).toBe(false);
    const terms = await get<{ sessionId: string }[]>('/academics/terms', as(ADMIN));
    expect(terms.data.some((term) => term.sessionId === create.data.id)).toBe(false);

    const currentSessionId = sessions.data.find((session) => session.isCurrent)!.id;
    const refused = await del(`/academics/sessions/${currentSessionId}`, as(ADMIN));
    expect(refused.status).toBe(409);
  });

  it('deletes a period, removing it from the timetable grid too', async () => {
    const create = await send<{ id: string }>(
      'POST',
      '/academics/periods',
      { name: 'Spare period', startTime: '15:00', endTime: '15:30', isBreak: false },
      as(ADMIN),
    );

    const removed = await del(`/academics/periods/${create.data.id}`, as(ADMIN));
    expect(removed.status).toBe(204);

    const periods = await get<{ id: string }[]>('/academics/periods', as(ADMIN));
    expect(periods.data.some((period) => period.id === create.data.id)).toBe(false);

    const timetable = await get<{ periods: { id: string }[] }>('/timetables/current', as(ADMIN));
    expect(timetable.data.periods.some((period) => period.id === create.data.id)).toBe(false);
  });

  it('refuses to delete a period that still has lessons scheduled in it', async () => {
    const timetable = await get<{ entries: { periodId: string }[] }>(
      '/timetables/current',
      as(ADMIN),
    );
    const occupiedPeriodId = timetable.data.entries[0].periodId;

    const refused = await del(`/academics/periods/${occupiedPeriodId}`, as(ADMIN));
    expect(refused.status).toBe(409);
  });

  it('creates and edits a level, class, subject, house and room', async () => {
    const level = await send<{ id: string; code: string }>(
      'POST',
      '/academics/levels',
      { name: 'JSS 4', sequence: 99 },
      as(ADMIN),
    );
    expect(level.status).toBe(201);
    expect(level.data.code).toBe('JSS4');

    const editedLevel = await send<{ name: string }>(
      'PATCH',
      `/academics/levels/${level.data.id}`,
      { name: 'JSS 4 (Renamed)' },
      as(ADMIN),
    );
    expect(editedLevel.data.name).toBe('JSS 4 (Renamed)');

    const staff = await get<{ items: { id: string; fullName: string }[] }>(
      '/staff?pageSize=1',
      as(ADMIN),
    );
    const teacher = staff.data.items[0];

    const schoolClass = await send<{ id: string; levelName: string; formTeacherName: string | null }>(
      'POST',
      '/academics/classes',
      { name: 'JSS 4 Diamond', levelId: level.data.id, capacity: 35, formTeacherId: teacher.id },
      as(ADMIN),
    );
    expect(schoolClass.status).toBe(201);
    expect(schoolClass.data.levelName).toBe('JSS 4 (Renamed)');
    expect(schoolClass.data.formTeacherName).toBe(teacher.fullName);

    const levelAfterClass = await get<{ id: string; classCount: number }[]>(
      '/academics/levels',
      as(ADMIN),
    );
    expect(levelAfterClass.data.find((entry) => entry.id === level.data.id)?.classCount).toBe(1);

    const unassigned = await send<{ formTeacherName: string | null }>(
      'PATCH',
      `/academics/classes/${schoolClass.data.id}`,
      { formTeacherId: null },
      as(ADMIN),
    );
    expect(unassigned.data.formTeacherName).toBeNull();

    const subject = await send<{ id: string; levelNames: string[] }>(
      'POST',
      '/academics/subjects',
      { name: 'Robotics', code: 'ROB', levelIds: [level.data.id], isCore: false },
      as(ADMIN),
    );
    expect(subject.status).toBe(201);
    expect(subject.data.levelNames).toEqual(['JSS 4 (Renamed)']);

    const house = await send<{ id: string; name: string }>(
      'POST',
      '/academics/houses',
      { name: 'Emerald', color: '#10b981', motto: 'Grow together' },
      as(ADMIN),
    );
    expect(house.status).toBe(201);

    const editedHouse = await send<{ motto: string | null }>(
      'PATCH',
      `/academics/houses/${house.data.id}`,
      { motto: 'Grow forever' },
      as(ADMIN),
    );
    expect(editedHouse.data.motto).toBe('Grow forever');

    const room = await send<{ id: string; code: string }>(
      'POST',
      '/academics/rooms',
      { name: 'Robotics Lab', capacity: 25, type: 'LABORATORY' },
      as(ADMIN),
    );
    expect(room.status).toBe(201);
    expect(room.data.code).toBe('ROBOTICSLAB');
  });

  it('saves and edits the weekly period schedule for a subject', async () => {
    const periods = await get<{ id: string }[]>('/academics/periods', as(ADMIN));
    const [periodOne, periodTwo] = periods.data;

    const subject = await send<{ id: string; schedule: { day: string; periodId: string }[] }>(
      'POST',
      '/academics/subjects',
      {
        name: 'Further Mathematics',
        code: 'FMT',
        schedule: [
          { day: 'MONDAY', periodId: periodOne.id },
          { day: 'WEDNESDAY', periodId: periodTwo.id },
        ],
      },
      as(ADMIN),
    );
    expect(subject.status).toBe(201);
    expect(subject.data.schedule).toEqual([
      { day: 'MONDAY', periodId: periodOne.id },
      { day: 'WEDNESDAY', periodId: periodTwo.id },
    ]);

    const edited = await send<{ schedule: { day: string; periodId: string }[] }>(
      'PATCH',
      `/academics/subjects/${subject.data.id}`,
      { schedule: [{ day: 'FRIDAY', periodId: periodOne.id }] },
      as(ADMIN),
    );
    expect(edited.data.schedule).toEqual([{ day: 'FRIDAY', periodId: periodOne.id }]);

    const withoutSchedule = await send<{ schedule: unknown[] }>(
      'POST',
      '/academics/subjects',
      { name: 'Latin', code: 'LAT' },
      as(ADMIN),
    );
    expect(withoutSchedule.data.schedule).toEqual([]);
  });

  it('refuses a student trying to write to levels, classes, subjects, houses or rooms', async () => {
    const level = await send('POST', '/academics/levels', { name: 'x' }, as(STUDENT));
    const schoolClass = await send('POST', '/academics/classes', { name: 'x' }, as(STUDENT));
    const subject = await send('POST', '/academics/subjects', { name: 'x' }, as(STUDENT));
    const house = await send('POST', '/academics/houses', { name: 'x' }, as(STUDENT));
    const room = await send('POST', '/academics/rooms', { name: 'x' }, as(STUDENT));

    expect(level.status).toBe(403);
    expect(schoolClass.status).toBe(403);
    expect(subject.status).toBe(403);
    expect(house.status).toBe(403);
    expect(room.status).toBe(403);
  });
});
