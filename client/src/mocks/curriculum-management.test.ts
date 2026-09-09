import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * CRUD for curricula, topics and objectives, plus the two rules that make the
 * screen safe to hand to a teacher: a curriculum belongs to one class, and it
 * records who wrote it.
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
const BURSAR = 'bursar@brightfield.edu.ng';

interface CurriculumRow {
  id: string;
  subjectId: string;
  classId: string;
  className: string;
  levelId: string;
  levelName: string;
  subjectName: string;
  topicCount: number;
  objectiveCount: number;
  createdById: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  sessionId: string;
  sessionName: string;
}
interface SessionRow {
  id: string;
  name: string;
  isCurrent: boolean;
}
interface TermRow {
  id: string;
  name: string;
  sessionId: string;
  isCurrent: boolean;
}
interface TopicRow {
  id: string;
  title: string;
  sequence: number;
  suggestedWeeks: number;
  objectives: { id: string; code: string; statement: string }[];
}
interface SubjectRow {
  id: string;
  levelIds: string[];
}
interface ClassRow {
  id: string;
  levelId: string;
}

describe('curriculum management', () => {
  /** A subject/class pair that has no curriculum yet, from the admin's full view. */
  async function pickFreePair(
    email = ADMIN,
  ): Promise<{ subjectId: string; classId: string }> {
    const [classes, subjects, existing] = await Promise.all([
      call<ClassRow[]>('GET', '/academics/classes', as(email)),
      call<SubjectRow[]>('GET', '/academics/subjects', as(email)),
      call<CurriculumRow[]>('GET', '/curricula', as(email)),
    ]);
    const taken = new Set(existing.data.map((c) => `${c.subjectId}:${c.classId}`));

    for (const schoolClass of classes.data) {
      for (const subject of subjects.data) {
        if (!subject.levelIds.includes(schoolClass.levelId)) continue;
        if (!taken.has(`${subject.id}:${schoolClass.id}`)) {
          return { subjectId: subject.id, classId: schoolClass.id };
        }
      }
    }
    throw new Error('No free subject/class combination for a new curriculum');
  }

  /**
   * A subject/class pair a teacher is genuinely assigned to teach, that has
   * no curriculum yet. Deliberately not `pickFreePair` above: picking a
   * class from the teacher's classes and a subject from their subjects
   * independently would rebuild the exact cross-product bug this scoping is
   * meant to prevent — a teacher assigned Biology in JSS 1 and Mathematics
   * in SSS 1 must not appear eligible for Mathematics in JSS 1.
   */
  async function pickFreePairForTeacher(
    email: string,
  ): Promise<{ subjectId: string; classId: string }> {
    const session = await call<{
      user: { memberships: { staffId?: string | null }[] };
    }>('GET', '/auth/session', as(email));
    const staffId = session.data.user.memberships.find((entry) => entry.staffId)?.staffId;
    expect(staffId).toBeTruthy();

    const staff = await call<{ teachingAssignments: { classId: string; subjectId: string }[] }>(
      'GET',
      `/staff/${staffId}`,
      as(email),
    );
    const existing = await call<CurriculumRow[]>('GET', '/curricula', as(email));
    const taken = new Set(existing.data.map((c) => `${c.subjectId}:${c.classId}`));

    const free = staff.data.teachingAssignments.find(
      (pair) => !taken.has(`${pair.subjectId}:${pair.classId}`),
    );
    if (!free) throw new Error(`${email} has no free assigned (class, subject) pair to test with`);
    return free;
  }

  it('creates, edits and deletes a curriculum for one class', async () => {
    const { subjectId, classId } = await pickFreePair();

    const createRes = await call<CurriculumRow>('POST', '/curricula', as(ADMIN), {
      subjectId,
      classId,
      description: 'A brand new curriculum',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.data.topicCount).toBe(0);
    expect(createRes.data.objectiveCount).toBe(0);
    expect(createRes.data.classId).toBe(classId);

    // The level is never sent — it is derived from the class.
    const classes = await call<ClassRow[]>('GET', '/academics/classes', as(ADMIN));
    const targetClass = classes.data.find((entry) => entry.id === classId)!;
    expect(createRes.data.levelId).toBe(targetClass.levelId);

    const editRes = await call<CurriculumRow>(
      'PATCH',
      `/curricula/${createRes.data.id}`,
      as(ADMIN),
      { description: 'Updated description' },
    );
    expect(editRes.status).toBe(200);

    const list = await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN));
    expect(list.data.some((c) => c.id === createRes.data.id)).toBe(true);

    const deleteRes = await call('DELETE', `/curricula/${createRes.data.id}`, as(ADMIN));
    expect(deleteRes.status).toBe(204);

    const listAfter = await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN));
    expect(listAfter.data.some((c) => c.id === createRes.data.id)).toBe(false);
  });

  it('records who wrote a curriculum, and never lets an edit rewrite that', async () => {
    const { subjectId, classId } = await pickFreePair();
    const created = await call<CurriculumRow>('POST', '/curricula', as(ADMIN), {
      subjectId,
      classId,
    });

    expect(created.data.createdById).toBe(`user_${ADMIN}`);
    expect(created.data.createdByName).toBe('Adaeze Okonkwo');
    expect(created.data.createdByRole).toBe('School admin');
    expect(created.data.createdAt).toBeTruthy();

    const edited = await call<CurriculumRow>(
      'PATCH',
      `/curricula/${created.data.id}`,
      as(ADMIN),
      { createdByName: 'Somebody Else', createdById: 'user_forged' },
    );
    expect(edited.data.createdByName).toBe('Adaeze Okonkwo');
    expect(edited.data.createdById).toBe(`user_${ADMIN}`);

    await call('DELETE', `/curricula/${created.data.id}`, as(ADMIN));
  });

  it('refuses a second curriculum for the same subject and class', async () => {
    const existing = await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN));
    const first = existing.data[0];

    const duplicate = await call('POST', '/curricula', as(ADMIN), {
      subjectId: first.subjectId,
      classId: first.classId,
    });
    expect(duplicate.status).toBe(409);
  });

  it('allows two curricula for the same subject at different classes', async () => {
    const classes = await call<ClassRow[]>('GET', '/academics/classes', as(ADMIN));
    const existing = await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN));
    const first = existing.data[0];

    // Another class at the same level, so the subject is certainly taught there.
    const sibling = classes.data.find(
      (entry) => entry.levelId === first.levelId && entry.id !== first.classId,
    );
    const taken = new Set(existing.data.map((c) => `${c.subjectId}:${c.classId}`));
    if (!sibling || taken.has(`${first.subjectId}:${sibling.id}`)) return;

    const second = await call<CurriculumRow>('POST', '/curricula', as(ADMIN), {
      subjectId: first.subjectId,
      classId: sibling.id,
    });
    expect(second.status).toBe(201);
    expect(second.data.classId).toBe(sibling.id);

    await call('DELETE', `/curricula/${second.data.id}`, as(ADMIN));
  });

  it('manages topics and objectives, keeping the curriculum counts in sync', async () => {
    const { subjectId, classId } = await pickFreePair();
    const curriculum = await call<CurriculumRow>('POST', '/curricula', as(ADMIN), {
      subjectId,
      classId,
    });
    const curriculumId = curriculum.data.id;

    const topic = await call<TopicRow>(
      'POST',
      `/curricula/${curriculumId}/topics`,
      as(ADMIN),
      { title: 'Test topic', suggestedWeeks: 2 },
    );
    expect(topic.status).toBe(201);
    expect(topic.data.objectives).toEqual([]);

    let curriculumRow = (await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN))).data.find(
      (c) => c.id === curriculumId,
    )!;
    expect(curriculumRow.topicCount).toBe(1);
    expect(curriculumRow.objectiveCount).toBe(0);

    const objective = await call<{ id: string; code: string; statement: string }>(
      'POST',
      `/curricula/${curriculumId}/topics/${topic.data.id}/objectives`,
      as(ADMIN),
      { statement: 'Define a test objective', bloomLevel: 'REMEMBER' },
    );
    expect(objective.status).toBe(201);
    expect(objective.data.statement).toBe('Define a test objective');

    curriculumRow = (await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN))).data.find(
      (c) => c.id === curriculumId,
    )!;
    expect(curriculumRow.objectiveCount).toBe(1);

    // Editing an objective must never disturb its coverage flags.
    await call(
      'POST',
      `/curricula/${curriculumId}/coverage`,
      as(ADMIN),
      { objectiveIds: [objective.data.id], taught: true },
    );
    const edited = await call<{ statement: string; taught: boolean }>(
      'PATCH',
      `/curricula/${curriculumId}/topics/${topic.data.id}/objectives/${objective.data.id}`,
      as(ADMIN),
      { statement: 'A revised statement' },
    );
    expect(edited.data.statement).toBe('A revised statement');
    expect(edited.data.taught).toBe(true);

    const deleteObjective = await call(
      'DELETE',
      `/curricula/${curriculumId}/topics/${topic.data.id}/objectives/${objective.data.id}`,
      as(ADMIN),
    );
    expect(deleteObjective.status).toBe(204);

    curriculumRow = (await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN))).data.find(
      (c) => c.id === curriculumId,
    )!;
    expect(curriculumRow.objectiveCount).toBe(0);

    const deleteTopic = await call(
      'DELETE',
      `/curricula/${curriculumId}/topics/${topic.data.id}`,
      as(ADMIN),
    );
    expect(deleteTopic.status).toBe(204);

    curriculumRow = (await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN))).data.find(
      (c) => c.id === curriculumId,
    )!;
    expect(curriculumRow.topicCount).toBe(0);

    await call('DELETE', `/curricula/${curriculumId}`, as(ADMIN));
    // A dozen round trips against a mock API that simulates latency on purpose.
  }, 20_000);

  it('blocks deleting a curriculum that has schemes of work built from it', async () => {
    const schemes = await call<{ items: { curriculumId: string }[] }>(
      'GET',
      '/schemes?pageSize=1',
      as(ADMIN),
    );
    const curriculumId = schemes.data.items[0]?.curriculumId;
    expect(curriculumId).toBeTruthy();

    const deleteRes = await call('DELETE', `/curricula/${curriculumId}`, as(ADMIN));
    expect(deleteRes.status).toBe(409);
  });

  it('lets a teacher write a curriculum for a class they teach', async () => {
    const { subjectId, classId } = await pickFreePairForTeacher(TEACHER);

    const res = await call<CurriculumRow>('POST', '/curricula', as(TEACHER), {
      subjectId,
      classId,
    });
    expect(res.status).toBe(201);
    expect(res.data.createdById).toBe(`user_${TEACHER}`);
    expect(res.data.createdByName).toBe('Funmilayo Adeyemi');

    // Their own work comes back in their own list.
    const mine = await call<CurriculumRow[]>(
      'GET',
      `/curricula?createdById=user_${TEACHER}`,
      as(TEACHER),
    );
    expect(mine.data.some((c) => c.id === res.data.id)).toBe(true);

    await call('DELETE', `/curricula/${res.data.id}`, as(TEACHER));
  });

  it('refuses a teacher a class they are not assigned to', async () => {
    const allClasses = await call<ClassRow[]>('GET', '/academics/classes', as(ADMIN));
    const mineClasses = await call<ClassRow[]>('GET', '/academics/classes', as(TEACHER));
    const mineIds = new Set(mineClasses.data.map((entry) => entry.id));

    // The teacher's own picker never offered this class in the first place.
    const foreign = allClasses.data.find((entry) => !mineIds.has(entry.id));
    expect(foreign).toBeTruthy();

    const subjects = await call<SubjectRow[]>('GET', '/academics/subjects', as(TEACHER));
    const res = await call('POST', '/curricula', as(TEACHER), {
      subjectId: subjects.data[0].id,
      classId: foreign!.id,
    });
    expect(res.status).toBe(403);
  });

  /**
   * A teacher who teaches Biology in JSS 1 and Mathematics in SSS 1 must not
   * thereby see a colleague's Mathematics/JSS 1 curriculum — that would be
   * treating "teaches this class" and "teaches this subject somewhere" as
   * independent facts that add up to "teaches this subject in this class",
   * which they do not. Regression test for exactly that report.
   */
  it("does not show a teacher another teacher's curriculum for a class and subject they each teach separately", async () => {
    const session = await call<{
      user: { memberships: { staffId?: string | null }[] };
    }>('GET', '/auth/session', as(TEACHER));
    const staffId = session.data.user.memberships.find((entry) => entry.staffId)?.staffId;
    expect(staffId).toBeTruthy();

    const staff = await call<{ teachingAssignments: { classId: string; subjectId: string }[] }>(
      'GET',
      `/staff/${staffId}`,
      as(TEACHER),
    );
    const pairs = staff.data.teachingAssignments;
    const taughtClassIds = Array.from(new Set(pairs.map((pair) => pair.classId)));
    const taughtSubjectIds = Array.from(new Set(pairs.map((pair) => pair.subjectId)));

    // Find a (class, subject) combination built from two things the teacher
    // separately teaches, but never together — the exact shape of the bug.
    let mismatch: { classId: string; subjectId: string } | undefined;
    outer: for (const classId of taughtClassIds) {
      for (const subjectId of taughtSubjectIds) {
        if (!pairs.some((pair) => pair.classId === classId && pair.subjectId === subjectId)) {
          mismatch = { classId, subjectId };
          break outer;
        }
      }
    }
    if (!mismatch) {
      throw new Error(
        `${TEACHER} teaches only one (class, subject) combination in this fixture — no mismatch available to test with`,
      );
    }

    // Someone else — a coordinator — writes it, same as an admin filling a
    // gap for a teacher who has not gotten to it yet.
    const theirs = await call<CurriculumRow>('POST', '/curricula', as(ADMIN), mismatch);
    expect(theirs.status).toBe(201);

    const list = await call<CurriculumRow[]>('GET', '/curricula', as(TEACHER));
    expect(list.data.some((c) => c.id === theirs.data.id)).toBe(false);

    const detail = await call('GET', `/curricula/${theirs.data.id}/topics`, as(TEACHER));
    expect(detail.status).toBe(404);

    await call('DELETE', `/curricula/${theirs.data.id}`, as(ADMIN));
  });

  /**
   * The list already hides a curriculum outside a teacher's classes and
   * subjects; the detail view — its actual topics and objectives — has to
   * refuse the same way for a link followed straight to it, or the list's
   * filtering is theatre rather than a real boundary.
   */
  it('refuses a teacher the topics of a curriculum outside their classes, even by direct link', async () => {
    const allClasses = await call<ClassRow[]>('GET', '/academics/classes', as(ADMIN));
    const mineClasses = await call<ClassRow[]>('GET', '/academics/classes', as(TEACHER));
    const mineIds = new Set(mineClasses.data.map((entry) => entry.id));
    const foreign = allClasses.data.find((entry) => !mineIds.has(entry.id));
    expect(foreign).toBeTruthy();

    const subjects = await call<SubjectRow[]>(
      'GET',
      `/academics/subjects?levelId=${foreign!.levelId}`,
      as(ADMIN),
    );
    const existingForClass = await call<CurriculumRow[]>(
      'GET',
      `/curricula?classId=${foreign!.id}&sessionId=ALL`,
      as(ADMIN),
    );
    const takenSubjectIds = new Set(existingForClass.data.map((entry) => entry.subjectId));
    const freeSubject = subjects.data.find((subject) => !takenSubjectIds.has(subject.id));
    expect(freeSubject).toBeTruthy();

    const curriculum = await call<CurriculumRow>('POST', '/curricula', as(ADMIN), {
      subjectId: freeSubject!.id,
      classId: foreign!.id,
    });
    expect(curriculum.status).toBe(201);

    const topicAsOwner = await call<TopicRow>(
      'POST',
      `/curricula/${curriculum.data.id}/topics`,
      as(ADMIN),
      { title: 'A topic the teacher must not see' },
    );
    expect(topicAsOwner.status).toBe(201);

    // Not in the list either — the same guarantee, checked the other way.
    const list = await call<CurriculumRow[]>('GET', '/curricula?sessionId=ALL', as(TEACHER));
    expect(list.data.some((entry) => entry.id === curriculum.data.id)).toBe(false);

    const topicsAsTeacher = await call<TopicRow[]>(
      'GET',
      `/curricula/${curriculum.data.id}/topics`,
      as(TEACHER),
    );
    expect(topicsAsTeacher.status).toBe(404);

    // The owner still sees it, so this is scoping, not a broken endpoint.
    const topicsAsOwner = await call<TopicRow[]>(
      'GET',
      `/curricula/${curriculum.data.id}/topics`,
      as(ADMIN),
    );
    expect(topicsAsOwner.status).toBe(200);
    expect(topicsAsOwner.data).toHaveLength(1);
  });

  it('refuses a bursar, who has no curriculum permission at all', async () => {
    const { subjectId, classId } = await pickFreePair();
    const res = await call('POST', '/curricula', as(BURSAR), { subjectId, classId });
    expect(res.status).toBe(403);
  });

  it('files a new curriculum under the session the school is currently in', async () => {
    const sessions = await call<SessionRow[]>('GET', '/academics/sessions', as(ADMIN));
    const current = sessions.data.find((session) => session.isCurrent)!;

    const { subjectId, classId } = await pickFreePair();
    const res = await call<CurriculumRow>('POST', '/curricula', as(ADMIN), {
      subjectId,
      classId,
    });
    expect(res.data.sessionId).toBe(current.id);
    expect(res.data.sessionName).toBe(current.name);

    // An edit cannot move it into another year.
    const other = sessions.data.find((session) => !session.isCurrent);
    if (other) {
      const edited = await call<CurriculumRow>(
        'PATCH',
        `/curricula/${res.data.id}`,
        as(ADMIN),
        { sessionId: other.id, sessionName: other.name },
      );
      expect(edited.data.sessionId).toBe(current.id);
    }

    await call('DELETE', `/curricula/${res.data.id}`, as(ADMIN));
  }, 20_000);

  it('follows the session when the admin makes another term current', async () => {
    const [sessionsBefore, terms] = await Promise.all([
      call<SessionRow[]>('GET', '/academics/sessions', as(ADMIN)),
      call<TermRow[]>('GET', '/academics/terms', as(ADMIN)),
    ]);
    const startingSession = sessionsBefore.data.find((session) => session.isCurrent)!;
    const startingTerm = terms.data.find((term) => term.isCurrent)!;

    const otherTerm = terms.data.find((term) => term.sessionId !== startingSession.id);
    expect(otherTerm).toBeTruthy();

    // Everything the school has planned so far sits in the starting session.
    const before = await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN));
    expect(before.data.length).toBeGreaterThan(0);
    for (const row of before.data) expect(row.sessionId).toBe(startingSession.id);

    await call('POST', `/academics/terms/${otherTerm!.id}/set-current`, as(ADMIN));

    // The session flag moved with the term.
    const sessionsAfter = await call<SessionRow[]>('GET', '/academics/sessions', as(ADMIN));
    expect(sessionsAfter.data.find((session) => session.isCurrent)?.id).toBe(
      otherTerm!.sessionId,
    );

    // And the default curriculum list is now that session's, which is empty.
    const after = await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN));
    expect(after.data).toHaveLength(0);

    // The earlier year is still reachable on purpose.
    const everything = await call<CurriculumRow[]>('GET', '/curricula?sessionId=ALL', as(ADMIN));
    expect(everything.data.length).toBe(before.data.length);

    // A curriculum written now belongs to the new session, even for a subject
    // and class that already had one last year.
    const previous = before.data[0];
    const fresh = await call<CurriculumRow>('POST', '/curricula', as(ADMIN), {
      subjectId: previous.subjectId,
      classId: previous.classId,
    });
    expect(fresh.status).toBe(201);
    expect(fresh.data.sessionId).toBe(otherTerm!.sessionId);

    await call('DELETE', `/curricula/${fresh.data.id}`, as(ADMIN));
    await call('POST', `/academics/terms/${startingTerm.id}/set-current`, as(ADMIN));
  }, 30_000);

  it('refuses to spread a curriculum across another session’s weeks', async () => {
    const [curricula, terms] = await Promise.all([
      call<CurriculumRow[]>('GET', '/curricula', as(ADMIN)),
      call<TermRow[]>('GET', '/academics/terms', as(ADMIN)),
    ]);
    const curriculum = curricula.data[0];
    const foreignTerm = terms.data.find((term) => term.sessionId !== curriculum.sessionId);
    if (!foreignTerm) return;

    const res = await call('POST', '/schemes/generate', as(ADMIN), {
      curriculumId: curriculum.id,
      termId: foreignTerm.id,
    });
    expect(res.status).toBe(422);
  });

  it('lets a coordinator delete a curriculum a teacher wrote', async () => {
    const { subjectId, classId } = await pickFreePairForTeacher(TEACHER);
    const mine = await call<CurriculumRow>('POST', '/curricula', as(TEACHER), {
      subjectId,
      classId,
    });

    // The principal wrote none of these, but coordinates all of them.
    const asPrincipal = await call(
      'DELETE',
      `/curricula/${mine.data.id}`,
      as('principal@brightfield.edu.ng'),
    );
    expect(asPrincipal.status).toBe(204);
  });
});
