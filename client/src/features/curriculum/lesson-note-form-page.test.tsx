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
const useAuthMock = vi.fn();

vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
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
  useAuthMock.mockReturnValue(
    authStub(['lessonnote.read', 'lessonnote.manage'], { membership: { staffId: 'stf_1' } }),
  );
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

/**
 * The scheme week's "Teaching resources" is HTML written in the same rich
 * text editor used everywhere else (`scheme-detail-page.tsx` renders it back
 * through a read-only `RichTextEditor`, not as plain text) — this page must
 * do the same instead of printing the markup itself, which showed up on
 * screen as a literal `<p>none</p>`.
 */
describe('LessonNoteFormPage — teaching resources', () => {
  it("renders the scheme week's resources as rich text, not raw HTML markup", async () => {
    useLessonNote.mockReturnValue({
      data: { ...note(), resources: '<p>Iodine solution, leaves</p>' },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    await waitFor(() => {
      expect(screen.getByText('Iodine solution, leaves')).toBeInTheDocument();
    });
    // The bug: the tags themselves showed up as visible text.
    expect(screen.queryByText('<p>Iodine solution, leaves</p>')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('<p>');
  });
});

/**
 * A reviewer's content fields render read-only once a note is SUBMITTED —
 * but `submit()` used to send them back to the server regardless, unchanged.
 * The server reads any content field in the body as an edit attempt and
 * refuses it with a 409 until the note is returned, even for a reviewer who
 * otherwise has edit rights, because it has no way to know nothing changed.
 * Approve and Return must send only the status and the review comment.
 */
describe('LessonNoteFormPage — reviewing a submitted note', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue(
      authStub(['lessonnote.read', 'lessonnote.approve'], { membership: { staffId: 'stf_2' } }),
    );
    useLessonNote.mockReturnValue({
      data: { ...note(), status: 'SUBMITTED' },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('disables Return until a comment is given', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    const returnButton = await screen.findByRole('button', { name: 'Return' });
    expect(returnButton).toBeDisabled();

    await user.type(screen.getByLabelText('Comment to the teacher'), 'Add the assignment.');

    expect(returnButton).toBeEnabled();
  });

  it("keeps the tooltip trigger off the disabled button itself, so hovering it still explains why", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    const returnButton = await screen.findByRole('button', { name: 'Return' });
    expect(returnButton).toBeDisabled();

    // A disabled button carries `disabled:pointer-events-none` (button.tsx),
    // so it can never receive the hover Radix's Tooltip.Trigger listens for.
    // The trigger must live on a wrapping element instead, so the tooltip
    // still opens — and still explains what to do — while disabled.
    expect(returnButton).not.toHaveAttribute('data-state');
    const trigger = returnButton.closest('[data-state]');
    expect(trigger).not.toBeNull();
    expect(trigger).not.toBe(returnButton);
    // Reachable by keyboard while the real button, disabled, is not.
    expect(trigger).toHaveAttribute('tabindex', '0');

    await user.type(screen.getByLabelText('Comment to the teacher'), 'Add the assignment.');

    // Once the button can take focus itself, the wrapper steps out of the tab order.
    expect(trigger).toHaveAttribute('tabindex', '-1');
  });

  it('keeps the same Return button in the page rather than swapping it out as the comment changes', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    const returnButton = await screen.findByRole('button', { name: 'Return' });
    await user.type(screen.getByLabelText('Comment to the teacher'), 'Add the assignment.');

    // Same node found earlier is still attached and live, not a stale
    // reference to one Tooltip unmounted when its content briefly went
    // undefined — see the comment on `returnHint` for why content is never
    // conditionally omitted.
    expect(returnButton).toBe(screen.getByRole('button', { name: 'Return' }));
    expect(returnButton).toBeEnabled();
  });

  it('sends only the status and comment when approving', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    await user.click(await screen.findByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    expect(saveMutate.mock.calls[0][0].values).toEqual({ status: 'APPROVED', reviewComment: null });
  });

  it('sends only the status and comment when returning, with the comment attached', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    await user.type(await screen.findByLabelText('Comment to the teacher'), 'Add the assignment.');
    await user.click(screen.getByRole('button', { name: 'Return' }));

    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    expect(saveMutate.mock.calls[0][0].values).toEqual({
      status: 'RETURNED',
      reviewComment: 'Add the assignment.',
    });
  });

  /**
   * Save draft, Submit, Return and Approve all call the same mutation, so
   * `save.isPending` alone can't tell them apart — every one of them would
   * show a spinner the moment any single one was clicked, which is exactly
   * what got reported: clicking Return also span up Approve right next to it.
   */
  it('spins only the button that was clicked, not every action button on the page', async () => {
    let resolveSave!: (value: LessonNote) => void;
    saveMutate.mockImplementation(
      () => new Promise<LessonNote>((resolve) => { resolveSave = resolve; }),
    );

    const user = userEvent.setup({ delay: null });
    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    await user.type(await screen.findByLabelText('Comment to the teacher'), 'Add the assignment.');
    const returnButton = screen.getByRole('button', { name: 'Return' });
    const approveButton = screen.getByRole('button', { name: 'Approve' });

    await user.click(returnButton);

    expect(returnButton.querySelector('.animate-spin')).toBeInTheDocument();
    // Approve is disabled so a second action can't race the first, but it
    // must not show as if it, too, were the one in flight.
    expect(approveButton).toBeDisabled();
    expect(approveButton.querySelector('.animate-spin')).not.toBeInTheDocument();

    resolveSave(note());
    await waitFor(() => expect(returnButton).not.toBeDisabled());
  });
});

/**
 * Once returned, a note is editable again — but only for the teacher who
 * wrote it. The admin who just returned it must not see it turn writable
 * for *them*, even holding academics.manage, which otherwise overrides
 * authorship on this note's delete path. Matches the server-side fix in
 * updateLessonNote (scheme.service.ts): mayEdit is author-only now.
 */
describe("LessonNoteFormPage — a note the viewer reviewed, not wrote", () => {
  it('stays read-only for the reviewer after they return it, despite holding academics.manage', async () => {
    useAuthMock.mockReturnValue(
      authStub(['lessonnote.read', 'lessonnote.manage', 'lessonnote.approve', 'academics.manage'], {
        membership: { staffId: 'stf_2' },
      }),
    );
    useLessonNote.mockReturnValue({
      data: { ...note(), status: 'RETURNED', reviewComment: 'Add the assignment.' },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    await screen.findByText('Returned for revision');

    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Date taught/)).toBeDisabled();
  });
});

/**
 * The other half of the same fix: RETURNED is still meant to be editable —
 * just for the person it was returned *to*. The default auth stub here
 * (staffId 'stf_1') matches `note()`'s default `teacherId`, so this is the
 * actual author looking at their own returned note.
 */
describe('LessonNoteFormPage — the author\'s own returned note', () => {
  it('is editable again for the teacher who wrote it', async () => {
    useLessonNote.mockReturnValue({
      data: { ...note(), status: 'RETURNED', reviewComment: 'Add the assignment.' },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<LessonNoteFormPage />, { route: '/lesson-notes/lsn_1', path: '/lesson-notes/:id', dataRouter: true });

    await screen.findByText('Returned for revision');

    expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date taught/)).toBeEnabled();
  });
});
