import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { renderPage, authStub } from '@/test/harness';
import { configureHttp } from '@/lib/http';
import { handlers } from '@/mocks/handlers';

/**
 * A user reported that adding one topic left five copies of it in the list.
 * A single click turns out to create exactly one (the first test below,
 * against the real mock server rather than a stubbed `./api`, proves that).
 * The real defect: the "Add topic" dialog reused the same component instance
 * across separate opens — `key` was keyed on the topic's id, and every "new
 * topic" open shares the same (absent) id — so whatever was typed, or left
 * mid-edit, from the previous open was still sitting in the field the next
 * time it opened. Repeatedly opening and saving without noticing the stale
 * text was still there is exactly how one topic becomes several.
 */
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['curriculum.read', 'curriculum.manage'], { user: { id: 'usr_admin_test' } }),
  useSchoolId: () => 'school_brightfield',
  usePermission: () => true,
}));

const BASE = `${location.origin}/api/v1`;
const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function as(email: string): RequestInit {
  return { headers: { Authorization: `Bearer mock-token:${email}` } };
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, as('admin@brightfield.edu.ng'));
  const body = (await response.json()) as { data: T };
  return body.data;
}

const { CurriculumDetailPage } = await import('./curriculum-detail-page');

let curriculumId: string;

beforeEach(async () => {
  configureHttp({
    tokenProvider: async () => 'mock-token:admin@brightfield.edu.ng',
    tenantProvider: () => 'school_brightfield',
  });
  const curricula = await get<{ id: string }[]>('/curricula');
  curriculumId = curricula[0].id;
});

describe('CurriculumDetailPage — add topic', () => {
  it('creates exactly one topic for one click of Save, and the list shows it once', async () => {
    const before = await get<{ id: string }[]>(`/curricula/${curriculumId}/topics`);

    const user = userEvent.setup();
    renderPage(<CurriculumDetailPage />, {
      route: `/curriculum/${curriculumId}`,
      path: '/curriculum/:id',
    });

    await user.click(await screen.findByRole('button', { name: 'Add topic' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Title', { exact: false }), 'Photo');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });

    // Give any stray in-flight requests a moment to land before counting.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const after = await get<{ id: string; title: string }[]>(`/curricula/${curriculumId}/topics`);
    const added = after.filter((topic) => topic.title === 'Photo');
    expect(added.length).toBe(1);
    expect(after.length).toBe(before.length + 1);

    // And the page itself renders it once, not five times.
    await waitFor(() => {
      expect(screen.getAllByText(/\bPhoto\b/)).toHaveLength(1);
    });
  });
});

describe('CurriculumDetailPage — reopening "Add topic"', () => {
  it('starts with a blank title, not whatever was typed (or left unsaved) last time', async () => {
    const user = userEvent.setup();
    renderPage(<CurriculumDetailPage />, {
      route: `/curriculum/${curriculumId}`,
      path: '/curriculum/:id',
    });

    await user.click(await screen.findByRole('button', { name: 'Add topic' }));
    await user.type(screen.getByLabelText('Title', { exact: false }), 'Stale text');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add topic' }));
    const titleInput = await screen.findByLabelText('Title', { exact: false });
    expect(titleInput).toHaveValue('');
  });
});
