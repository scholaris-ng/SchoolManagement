import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The coverage endpoint tracks two independent flags per objective — taught
 * and assessed — but an objective cannot be assessed without being taught
 * first, matching what the "taught but not assessed" stat on the curriculum
 * page assumes is even possible. This exercises that invariant directly
 * against the handler, since it is enforced there, not in the UI.
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
const STUDENT = 'student@brightfield.edu.ng';

interface Objective {
  id: string;
  taught: boolean;
  assessed: boolean;
}
interface Topic {
  id: string;
  objectives: Objective[];
}

describe('curriculum coverage', () => {
  async function firstCurriculumTopics(): Promise<Topic[]> {
    const curricula = await get<{ id: string }[]>('/curricula', as(ADMIN));
    const curriculumId = curricula.data[0].id;
    const topics = await get<Topic[]>(`/curricula/${curriculumId}/topics`, as(ADMIN));
    return topics.data;
  }

  it('marks objectives taught and assessed independently', async () => {
    const topics = await firstCurriculumTopics();
    const curriculumId = (await get<{ id: string }[]>('/curricula', as(ADMIN))).data[0].id;
    const objective = topics[0].objectives[0];

    await post(`/curricula/${curriculumId}/coverage`, { objectiveIds: [objective.id], taught: true }, as(ADMIN));
    await post(
      `/curricula/${curriculumId}/coverage`,
      { objectiveIds: [objective.id], assessed: true },
      as(ADMIN),
    );

    const after = await firstCurriculumTopics();
    const updated = after.flatMap((t) => t.objectives).find((o) => o.id === objective.id)!;
    expect(updated.taught).toBe(true);
    expect(updated.assessed).toBe(true);
  });

  it('refuses to mark an untaught objective assessed', async () => {
    const topics = await firstCurriculumTopics();
    const curriculumId = (await get<{ id: string }[]>('/curricula', as(ADMIN))).data[0].id;
    const objective = topics.flatMap((t) => t.objectives).find((o) => !o.taught)!;

    await post(
      `/curricula/${curriculumId}/coverage`,
      { objectiveIds: [objective.id], assessed: true },
      as(ADMIN),
    );

    const after = await firstCurriculumTopics();
    const updated = after.flatMap((t) => t.objectives).find((o) => o.id === objective.id)!;
    expect(updated.taught).toBe(false);
    expect(updated.assessed).toBe(false);
  });

  it('clears assessed when an objective is marked not taught', async () => {
    const topics = await firstCurriculumTopics();
    const curriculumId = (await get<{ id: string }[]>('/curricula', as(ADMIN))).data[0].id;
    const objective = topics.flatMap((t) => t.objectives).find((o) => o.taught && o.assessed)!;
    expect(objective).toBeTruthy();

    await post(
      `/curricula/${curriculumId}/coverage`,
      { objectiveIds: [objective.id], taught: false },
      as(ADMIN),
    );

    const after = await firstCurriculumTopics();
    const updated = after.flatMap((t) => t.objectives).find((o) => o.id === objective.id)!;
    expect(updated.taught).toBe(false);
    expect(updated.assessed).toBe(false);
  });

  it('refuses a student trying to mark coverage', async () => {
    const topics = await firstCurriculumTopics();
    const curriculumId = (await get<{ id: string }[]>('/curricula', as(ADMIN))).data[0].id;
    const objective = topics[0].objectives[0];

    const refused = await post(
      `/curricula/${curriculumId}/coverage`,
      { objectiveIds: [objective.id], assessed: true },
      as(STUDENT),
    );
    expect(refused.status).toBe(403);
  });
});
