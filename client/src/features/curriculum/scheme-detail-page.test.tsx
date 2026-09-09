import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import type { SchemeOfWork } from '@/types/curriculum';

const useScheme = vi.fn();
const saveMutate = vi.fn();
const useSaveScheme = vi.fn();

vi.mock('./api', () => ({
  useScheme: (...args: unknown[]) => useScheme(...args),
  useSaveScheme: (...args: unknown[]) => useSaveScheme(...args),
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['scheme.manage']),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { SchemeDetailPage } = await import('./scheme-detail-page');

function scheme(): SchemeOfWork {
  return {
    id: 'sow_1',
    schoolId: 'sch_1',
    subjectId: 'sub_1',
    subjectName: 'Biology',
    classId: 'cls_1',
    className: 'JSS 1 Gold',
    termId: 'trm_1',
    termName: 'First Term',
    sessionName: '2026/2027',
    curriculumId: 'cur_1',
    status: 'DRAFT',
    createdByName: 'Funmilayo Adeyemi',
    version: 1,
    weeks: [
      {
        id: 'wk_1',
        weekNumber: 1,
        startDate: '2026-09-08',
        endDate: '2026-09-12',
        topicId: 'top_1',
        topicTitle: 'Photosynthesis',
        objectiveIds: [],
        objectiveStatements: [],
        activities: 'Leaf chromatography demonstration',
        resources: 'Iodine solution, leaves',
        isBreak: false,
      },
      {
        id: 'wk_2',
        weekNumber: 2,
        startDate: '2026-09-15',
        endDate: '2026-09-19',
        topicId: 'top_2',
        topicTitle: 'Respiration',
        objectiveIds: [],
        objectiveStatements: [],
        activities: 'Candle and jar demonstration',
        resources: 'Candle, glass jar, stopwatch',
        isBreak: false,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveMutate.mockResolvedValue(undefined);
  useSaveScheme.mockReturnValue({ mutateAsync: saveMutate, isPending: false });
  useScheme.mockReturnValue({
    data: scheme(),
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

/**
 * Each week's Activities/Resources field is now an uncontrolled
 * RichTextEditor, mounted once per week and keyed on the week's own id (see
 * rich-text-editor.tsx for why it doesn't react to prop changes after
 * mount). Moving a week swaps array positions while `weekNumber` stays put
 * on the slot — content has to follow the id through that, not the index,
 * or a reorder would silently swap Week 1's Activities into Week 2's card.
 */
describe('SchemeDetailPage', () => {
  it('renders each week’s own activities and resources', async () => {
    renderPage(<SchemeDetailPage />, { route: '/schemes/sow_1', path: '/schemes/:id' });

    await waitFor(() => {
      expect(screen.getByText('Leaf chromatography demonstration')).toBeInTheDocument();
    });
    expect(screen.getByText('Iodine solution, leaves')).toBeInTheDocument();
    expect(screen.getByText('Candle and jar demonstration')).toBeInTheDocument();
    expect(screen.getByText('Candle, glass jar, stopwatch')).toBeInTheDocument();
  });

  it('keeps activities and resources attached to their own week when weeks are reordered', async () => {
    const user = userEvent.setup();
    renderPage(<SchemeDetailPage />, { route: '/schemes/sow_1', path: '/schemes/:id' });

    await waitFor(() => {
      expect(screen.getByText('Leaf chromatography demonstration')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Move week 2 earlier' }));

    const cards = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.closest<HTMLElement>('.rounded-lg')!);
    const firstCard = cards[0];
    const secondCard = cards[1];

    // The slot still reads "Week 1", but Respiration's own content moved
    // into it along with its id. Topic is a plain input, so its content
    // lives in `value`, not text — everything else renders as real text.
    expect(within(firstCard).getByDisplayValue('Respiration')).toBeInTheDocument();
    expect(within(firstCard).getByText('Candle and jar demonstration')).toBeInTheDocument();
    expect(within(secondCard).getByDisplayValue('Photosynthesis')).toBeInTheDocument();
    expect(within(secondCard).getByText('Leaf chromatography demonstration')).toBeInTheDocument();
  });
});
