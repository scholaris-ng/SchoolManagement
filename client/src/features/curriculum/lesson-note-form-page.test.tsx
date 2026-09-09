import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import type { LessonNote } from '@/types/curriculum';

const useLessonNote = vi.fn();
const useSchemes = vi.fn();
const useScheme = vi.fn();
const saveMutate = vi.fn();
const useSaveLessonNote = vi.fn();
const deleteMutate = vi.fn();
const useDeleteLessonNote = vi.fn();

vi.mock('./api', () => ({
  useLessonNote: (...args: unknown[]) => useLessonNote(...args),
  useSchemes: (...args: unknown[]) => useSchemes(...args),
  useScheme: (...args: unknown[]) => useScheme(...args),
  useSaveLessonNote: (...args: unknown[]) => useSaveLessonNote(...args),
  useDeleteLessonNote: (...args: unknown[]) => useDeleteLessonNote(...args),
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['lessonnote.read', 'lessonnote.manage'], {
    membership: { staffId: 'stf_1' },
  }),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { LessonNoteFormPage } = await import('./lesson-note-form-page');

function note(): LessonNote {
  return {
    id: 'lsn_1',
    schoolId: 'sch_1',
    teacherId: 'stf_1',
    teacherName: 'Funmilayo Adeyemi',
    schemeId: 'sow_1',
    schemeWeekId: 'wk_1',
    classId: 'cls_1',
    className: 'JSS 1 Gold',
    subjectId: 'sub_1',
    subjectName: 'Biology',
    termId: 'trm_1',
    weekNumber: 1,
    date: '2026-09-08',
    topic: 'Photosynthesis',
    objectiveIds: [],
    objectiveStatements: [],
    content: '<p>Introduced the topic.</p>',
    resources: null,
    assignment: '<p>Exercise 4, questions 1-8.</p>',
    challenges: '<p>Too few textbooks to go round.</p>',
    studentDifficulties: '<p>Word equation confused a third of the class.</p>',
    status: 'DRAFT',
    reviewerName: null,
    reviewedAt: null,
    reviewComment: null,
    version: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveMutate.mockResolvedValue(note());
  useSaveLessonNote.mockReturnValue({ mutateAsync: saveMutate, isPending: false, error: null });
  deleteMutate.mockResolvedValue(undefined);
  useDeleteLessonNote.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });
  useSchemes.mockReturnValue({ data: { items: [], meta: {} }, isPending: false });
  useScheme.mockReturnValue({ data: undefined, isPending: false });
  useLessonNote.mockReturnValue({
    data: note(),
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

/**
 * Assignment, challenges and where-students-struggled were plain textareas;
 * they are now the same RichTextEditor "What you taught" already used, so a
 * teacher can format them (lists, emphasis) instead of a wall of plain text.
 */
describe('LessonNoteFormPage — rich text fields', () => {
  it('renders assignment, challenges and student difficulties as rich text, not plain textareas', async () => {
    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    await waitFor(() => {
      expect(screen.getByText('Exercise 4, questions 1-8.')).toBeInTheDocument();
    });
    expect(screen.getByText('Too few textbooks to go round.')).toBeInTheDocument();
    expect(screen.getByText('Word equation confused a third of the class.')).toBeInTheDocument();

    // Quill's contenteditable root carries the field's id, the same way the
    // existing "What you taught" editor does — not a <textarea>.
    expect(document.querySelector('textarea#note-assignment')).not.toBeInTheDocument();
    expect(document.querySelector('textarea#note-challenges')).not.toBeInTheDocument();
    expect(document.querySelector('textarea#note-difficulties')).not.toBeInTheDocument();
    expect(document.querySelector('#note-assignment.ql-editor')).toBeInTheDocument();
    expect(document.querySelector('#note-challenges.ql-editor')).toBeInTheDocument();
    expect(document.querySelector('#note-difficulties.ql-editor')).toBeInTheDocument();
  });

  it('saves typed changes to the assignment field as HTML', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    const assignmentEditor = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('#note-assignment.ql-editor');
      expect(el).toBeTruthy();
      return el!;
    });

    await user.click(assignmentEditor);
    await user.type(assignmentEditor, ' Extra.');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    const values = saveMutate.mock.calls[0][0].values as { assignment: string };
    expect(values.assignment).toContain('Extra.');
  });
});
