import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * CRUD for curricula, topics and objectives — the mock-API surface the admin
 * UI needs since none of this was previously anything but seeded, read-only
 * data.
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

interface CurriculumRow {
  id: string;
  subjectId: string;
  levelId: string;
  subjectName: string;
  levelName: string;
  topicCount: number;
  objectiveCount: number;
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
}
interface LevelRow {
  id: string;
}

describe('curriculum management', () => {
  async function pickSubjectAndLevel(): Promise<{ subjectId: string; levelId: string }> {
    const subjects = await call<SubjectRow[]>('GET', '/academics/subjects', as(ADMIN));
    const levels = await call<LevelRow[]>('GET', '/academics/levels', as(ADMIN));
    const existing = await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN));
    const taken = new Set(existing.data.map((c) => `${c.subjectId}:${c.levelId}`));
    for (const subject of subjects.data) {
      for (const level of levels.data) {
        if (!taken.has(`${subject.id}:${level.id}`)) {
          return { subjectId: subject.id, levelId: level.id };
        }
      }
    }
    throw new Error('No free subject/level combination for a new curriculum');
  }

  it('creates, edits and deletes a curriculum', async () => {
    const { subjectId, levelId } = await pickSubjectAndLevel();

    const createRes = await call<CurriculumRow>(
      'POST',
      '/curricula',
      as(ADMIN),
      { subjectId, levelId, description: 'A brand new curriculum' },
    );
    expect(createRes.status).toBe(201);
    expect(createRes.data.topicCount).toBe(0);
    expect(createRes.data.objectiveCount).toBe(0);

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

  it('refuses a duplicate curriculum for the same subject and level', async () => {
    const existing = await call<CurriculumRow[]>('GET', '/curricula', as(ADMIN));
    const first = existing.data[0];

    const duplicate = await call(
      'POST',
      '/curricula',
      as(ADMIN),
      { subjectId: first.subjectId, levelId: first.levelId },
    );
    expect(duplicate.status).toBe(409);
  });

  it('manages topics and objectives, keeping the curriculum counts in sync', async () => {
    const { subjectId, levelId } = await pickSubjectAndLevel();
    const curriculum = await call<CurriculumRow>(
      'POST',
      '/curricula',
      as(ADMIN),
      { subjectId, levelId },
    );
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
  });

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

  it('refuses a teacher without curriculum.manage from creating a curriculum', async () => {
    const { subjectId, levelId } = await pickSubjectAndLevel();
    const res = await call('POST', '/curricula', as(TEACHER), { subjectId, levelId });
    expect(res.status).toBe(403);
  });
});
