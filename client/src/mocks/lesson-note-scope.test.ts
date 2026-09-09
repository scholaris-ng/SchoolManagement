import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * A lesson note is one teacher's personal record of what they actually
 * taught — unlike a curriculum or a scheme of work, teaching the same class
 * and subject elsewhere does not entitle a colleague to read it. Nothing
 * enforced that before: any staff member with `lessonnote.read` saw every
 * teacher's notes, and `lessonnote.manage` let them edit any of them.
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
const PRINCIPAL = 'principal@brightfield.edu.ng';

interface LessonNoteRow {
  id: string;
  teacherId: string;
  teacherName: string;
  topic: string;
  status: string;
}
interface Page<T> {
  items: T[];
}

async function staffId(email: string): Promise<string> {
  const session = await call<{ user: { memberships: { staffId?: string | null }[] } }>(
    'GET',
    '/auth/session',
    as(email),
  );
  const id = session.data.user.memberships.find((entry) => entry.staffId)?.staffId;
  expect(id).toBeTruthy();
  return id!;
}

describe("a lesson note is visible only to the teacher who wrote it, or a reviewer", () => {
  it('lists only the signed-in teacher’s own notes', async () => {
    const mine = await call<Page<LessonNoteRow>>('GET', '/lesson-notes?pageSize=200', as(TEACHER));
    const teacherStaffId = await staffId(TEACHER);

    expect(mine.data.items.length).toBeGreaterThan(0);
    for (const note of mine.data.items) expect(note.teacherId).toBe(teacherStaffId);

    const asReviewer = await call<Page<LessonNoteRow>>(
      'GET',
      '/lesson-notes?pageSize=200',
      as(PRINCIPAL),
    );
    expect(asReviewer.data.items.length).toBeGreaterThan(mine.data.items.length);
  });

  it('refuses a teacher a colleague’s note, even by direct link', async () => {
    const teacherStaffId = await staffId(TEACHER);
    const whole = await call<Page<LessonNoteRow>>(
      'GET',
      '/lesson-notes?pageSize=200',
      as(PRINCIPAL),
    );
    const foreign = whole.data.items.find((note) => note.teacherId !== teacherStaffId);
    expect(foreign).toBeTruthy();

    const detail = await call('GET', `/lesson-notes/${foreign!.id}`, as(TEACHER));
    expect(detail.status).toBe(404);

    const patch = await call('PATCH', `/lesson-notes/${foreign!.id}`, as(TEACHER), {
      topic: 'Rewritten by someone else',
    });
    expect(patch.status).toBe(403);
  });

  it('still lets a reviewer read and approve any teacher’s note', async () => {
    const teacherStaffId = await staffId(TEACHER);
    const mine = await call<Page<LessonNoteRow>>('GET', '/lesson-notes?pageSize=200', as(TEACHER));
    const note = mine.data.items.find((entry) => entry.status !== 'APPROVED');
    expect(note).toBeTruthy();
    expect(note!.teacherId).toBe(teacherStaffId);

    const detail = await call('GET', `/lesson-notes/${note!.id}`, as(PRINCIPAL));
    expect(detail.status).toBe(200);

    const approve = await call('PATCH', `/lesson-notes/${note!.id}`, as(PRINCIPAL), {
      status: 'APPROVED',
    });
    expect(approve.status).toBe(200);
  });

  it('leaves an administrator unrestricted', async () => {
    const admin = await call<Page<LessonNoteRow>>('GET', '/lesson-notes?pageSize=200', as(ADMIN));
    const reviewer = await call<Page<LessonNoteRow>>(
      'GET',
      '/lesson-notes?pageSize=200',
      as(PRINCIPAL),
    );
    expect(admin.data.items.length).toBe(reviewer.data.items.length);
  });

  /**
   * Lesson notes are seeded before a persona's staff record is renamed to
   * its real login name, and unlike curricula and schemes that rename was
   * never carried over to `teacherName`. Invisible before this file's
   * scoping: a mixed list of many teachers hid a stale name among real
   * ones. A list narrowed to "only mine" makes every row wrong the same
   * way, and looks exactly like someone else's notes.
   */
  it('shows the teacher their own real name, not the seed name their staff record started with', async () => {
    const session = await call<{ user: { displayName: string } }>('GET', '/auth/session', as(TEACHER));
    const realName = session.data.user.displayName;
    expect(realName).toBe('Funmilayo Adeyemi');

    const mine = await call<Page<LessonNoteRow>>('GET', '/lesson-notes?pageSize=200', as(TEACHER));
    expect(mine.data.items.length).toBeGreaterThan(0);
    for (const note of mine.data.items) expect(note.teacherName).toBe(realName);
  });
});

describe('deleting a lesson note', () => {
  async function createNote(email: string): Promise<string> {
    const classes = await call<{ id: string }[]>('GET', '/academics/classes', as(email));
    const subjects = await call<{ id: string }[]>(
      'GET',
      `/academics/subjects?classId=${classes.data[0].id}`,
      as(email),
    );
    const created = await call<{ id: string }>('POST', '/lesson-notes', as(email), {
      classId: classes.data[0].id,
      subjectId: subjects.data[0].id,
      weekNumber: 1,
      date: '2026-09-08',
      topic: 'Deletable note',
      content: 'Test content.',
    });
    expect(created.status).toBe(201);
    return created.data.id;
  }

  it('lets a teacher delete their own note', async () => {
    const noteId = await createNote(TEACHER);

    const res = await call('DELETE', `/lesson-notes/${noteId}`, as(TEACHER));
    expect(res.status).toBe(204);

    const after = await call('GET', `/lesson-notes/${noteId}`, as(TEACHER));
    expect(after.status).toBe(404);
  });

  it('refuses a teacher a colleague’s note, leaving it in place', async () => {
    const teacherStaffId = await staffId(TEACHER);
    const whole = await call<Page<LessonNoteRow>>(
      'GET',
      '/lesson-notes?pageSize=200',
      as(ADMIN),
    );
    const foreign = whole.data.items.find((note) => note.teacherId !== teacherStaffId);
    expect(foreign).toBeTruthy();

    const res = await call('DELETE', `/lesson-notes/${foreign!.id}`, as(TEACHER));
    expect(res.status).toBe(403);

    const stillThere = await call('GET', `/lesson-notes/${foreign!.id}`, as(ADMIN));
    expect(stillThere.status).toBe(200);
  });

  it('lets a coordinator delete a note they did not write', async () => {
    const noteId = await createNote(TEACHER);

    const res = await call('DELETE', `/lesson-notes/${noteId}`, as(ADMIN));
    expect(res.status).toBe(204);

    const after = await call('GET', `/lesson-notes/${noteId}`, as(ADMIN));
    expect(after.status).toBe(404);
  });

  it('refuses a reviewer who only approves notes, not manages them', async () => {
    const noteId = await createNote(TEACHER);

    const res = await call('DELETE', `/lesson-notes/${noteId}`, as(PRINCIPAL));
    expect(res.status).toBe(403);
  });
});
