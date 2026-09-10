import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import type { Curriculum, CurriculumCoverage, CurriculumTopic } from '@/types/curriculum';

/**
 * A user reported that adding one topic left five copies of it in the list.
 * A single click turns out to create exactly one (the first test below
 * proves that, against a small stateful fake of the endpoints module rather
 * than a real server). The real defect: the "Add topic" dialog reused the
 * same component instance across separate opens — `key` was keyed on the
 * topic's id, and every "new topic" open shares the same (absent) id — so
 * whatever was typed, or left mid-edit, from the previous open was still
 * sitting in the field the next time it opened. Repeatedly opening and saving
 * without noticing the stale text was still there is exactly how one topic
 * becomes several.
 */
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['curriculum.read', 'curriculum.manage'], { user: { id: 'usr_admin_test' } }),
  useSchoolId: () => 'school_brightfield',
  usePermission: () => true,
}));

const CURRICULUM_ID = 'curr_1';

const CURRICULUM: Curriculum = {
  id: CURRICULUM_ID,
  schoolId: 'school_brightfield',
  name: 'Basic Science — JSS 1 Gold',
  subjectId: 'sub_1',
  subjectName: 'Basic Science',
  classId: 'class_1',
  className: 'JSS 1 Gold',
  levelId: 'level_1',
  levelName: 'JSS 1',
  sessionId: 'session_1',
  sessionName: '2025/2026',
  description: null,
  topicCount: 0,
  objectiveCount: 0,
  isActive: true,
  createdById: 'usr_admin_test',
  createdByName: 'Admin Test',
  createdByRole: 'School administrator',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const COVERAGE: CurriculumCoverage = {
  curriculumId: CURRICULUM_ID,
  subjectName: CURRICULUM.subjectName,
  className: CURRICULUM.className,
  termName: 'First term',
  totalObjectives: 0,
  taughtCount: 0,
  assessedCount: 0,
  taughtNotAssessed: 0,
  neverTaught: 0,
  coverageRate: 0,
  assessmentRate: 0,
  cells: [],
};

/**
 * A minimal, stateful stand-in for the real endpoints — just enough to prove
 * one "Save" click produces one topic, and that a fresh dialog starts blank.
 * Everything else the page might call is stubbed to fail loudly rather than
 * silently, so an untested code path shows up as a test failure, not a
 * false pass.
 */
let topics: CurriculumTopic[] = [];
let nextTopicId = 1;

vi.mock('./curriculum.endpoints', () => ({
  CurriculumEndpoints: {
    fetchAll: async () => [CURRICULUM],
    fetchTopics: async () => topics,
    createTopic: async (_curriculumId: string, values: Partial<CurriculumTopic>) => {
      const topic: CurriculumTopic = {
        id: `topic_${nextTopicId++}`,
        curriculumId: CURRICULUM_ID,
        title: values.title ?? '',
        description: values.description ?? null,
        sequence: values.sequence ?? topics.length + 1,
        suggestedWeeks: values.suggestedWeeks ?? 1,
        objectives: [],
      };
      topics = [...topics, topic];
      return topic;
    },
    fetchCoverage: async () => COVERAGE,
  },
}));

const { CurriculumDetailPage } = await import('./curriculum-detail-page');

beforeEach(() => {
  topics = [];
  nextTopicId = 1;
});

describe('CurriculumDetailPage — add topic', () => {
  it('creates exactly one topic for one click of Save, and the list shows it once', async () => {
    const user = userEvent.setup();
    renderPage(<CurriculumDetailPage />, {
      route: `/curriculum/${CURRICULUM_ID}`,
      path: '/curriculum/:id',
    });

    await user.click(await screen.findByRole('button', { name: 'Add topic' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Title', { exact: false }), 'Photo');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });

    await waitFor(() => {
      const added = topics.filter((topic) => topic.title === 'Photo');
      expect(added.length).toBe(1);
    });

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
      route: `/curriculum/${CURRICULUM_ID}`,
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
