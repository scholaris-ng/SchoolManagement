import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import { ApiError } from '@/lib/api-error';
import { ApiErrorCode } from '@/types/api';
import type { Timetable } from '@/types/curriculum';

const useCurrentTimetable = vi.fn();
const saveMutate = vi.fn();
const useSaveTimetableEntry = vi.fn();
const deleteMutate = vi.fn();
const useDeleteTimetableEntry = vi.fn();
const clearMutate = vi.fn();
const useClearTimetable = vi.fn();

vi.mock('./api', () => ({
  useCurrentTimetable: (...args: unknown[]) => useCurrentTimetable(...args),
  useSaveTimetableEntry: (...args: unknown[]) => useSaveTimetableEntry(...args),
  useDeleteTimetableEntry: (...args: unknown[]) => useDeleteTimetableEntry(...args),
  useClearTimetable: (...args: unknown[]) => useClearTimetable(...args),
}));
vi.mock('@/features/academics/api', () => ({
  useClasses: () => ({
    data: [
      { id: 'cls_1', name: 'JSS 1 Gold' },
      { id: 'cls_2', name: 'JSS 1 Silver' },
    ],
    isPending: false,
  }),
  useRooms: () => ({ data: [], isPending: false }),
  useSubjects: () => ({
    data: [
      { id: 'sub_1', name: 'Mathematics' },
      { id: 'sub_2', name: 'English Language' },
    ],
    isPending: false,
  }),
}));
vi.mock('@/features/staff/api', () => ({
  useTeacherOptions: () => [
    { value: 'stf_1', label: 'Funmilayo Adeyemi' },
    { value: 'stf_2', label: 'Ibrahim Sule' },
  ],
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['timetable.read', 'timetable.manage']),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));
vi.mock('@/lib/toast-bus', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const { TimetablePage } = await import('./timetable-page');
const { toast } = await import('@/lib/toast-bus');

function timetable(): Timetable {
  return {
    id: 'ttb_1',
    schoolId: 'sch_1',
    name: 'Main timetable',
    sessionId: 'ses_1',
    termId: 'trm_1',
    termName: 'First Term',
    status: 'PUBLISHED',
    version: 1,
    periods: [
      {
        id: 'per_1',
        schoolId: 'sch_1',
        name: 'Period 1',
        startTime: '08:00',
        endTime: '08:40',
        sequence: 1,
        isBreak: false,
      },
      {
        id: 'per_2',
        schoolId: 'sch_1',
        name: 'Period 2',
        startTime: '08:40',
        endTime: '09:20',
        sequence: 2,
        isBreak: false,
      },
    ],
    entries: [
      {
        id: 'tte_1',
        schoolId: 'sch_1',
        timetableId: 'ttb_1',
        classId: 'cls_1',
        className: 'JSS 1 Gold',
        subjectId: 'sub_1',
        subjectName: 'Mathematics',
        teacherId: 'stf_1',
        teacherName: 'Funmilayo Adeyemi',
        roomId: null,
        roomName: null,
        periodId: 'per_1',
        periodName: 'Period 1',
        startTime: '08:00',
        endTime: '08:40',
        day: 'MONDAY',
      },
      {
        id: 'tte_2',
        schoolId: 'sch_1',
        timetableId: 'ttb_1',
        classId: 'cls_2',
        className: 'JSS 1 Silver',
        subjectId: 'sub_2',
        subjectName: 'English Language',
        teacherId: 'stf_2',
        teacherName: 'Ibrahim Sule',
        roomId: null,
        roomName: null,
        periodId: 'per_2',
        periodName: 'Period 2',
        startTime: '08:40',
        endTime: '09:20',
        day: 'MONDAY',
      },
    ],
  };
}

/** jsdom has no working DataTransfer, so drag events share a plain stand-in. */
function dataTransferStub() {
  const store = new Map<string, string>();
  return {
    setData: (format: string, value: string) => store.set(format, value),
    getData: (format: string) => store.get(format) ?? '',
    dropEffect: 'none',
    effectAllowed: 'none',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveMutate.mockResolvedValue(undefined);
  useSaveTimetableEntry.mockReturnValue({ mutateAsync: saveMutate, isPending: false });
  deleteMutate.mockResolvedValue(undefined);
  useDeleteTimetableEntry.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });
  clearMutate.mockResolvedValue(undefined);
  useClearTimetable.mockReturnValue({ mutateAsync: clearMutate, isPending: false });
  useCurrentTimetable.mockReturnValue({
    data: timetable(),
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

/**
 * Dragging a lesson onto another period is the way to move it — there is no
 * other path to change a lesson's day/period once it exists. Every non-break
 * period is a valid drop target, including one that already holds a lesson
 * for a different class: in the unfiltered "All classes" view almost every
 * period has something in it, so restricting drops to empty cells would leave
 * nowhere to drop. The server's clash detection (research feature 25) is the
 * real gate, so this file exercises the drag interaction that reaches it and
 * that it surfaces a real clash rather than moving silently.
 */
describe('TimetablePage', () => {
  it('moves a lesson to an empty period when it is dropped there', async () => {
    renderPage(<TimetablePage />);

    const lesson = await screen.findByRole('button', { name: /Mathematics/ });
    const target = screen.getByRole('button', { name: 'Add a lesson on Tuesday in Period 1' });
    const dataTransfer = dataTransferStub();

    fireEvent.dragStart(lesson, { dataTransfer });
    // The drop target is the <td> wrapping the "add" button — that is where
    // the page's onDragOver/onDrop handlers live.
    const targetCell = target.closest('td')!;
    fireEvent.dragOver(targetCell, { dataTransfer });
    fireEvent.drop(targetCell, { dataTransfer });

    expect(saveMutate).toHaveBeenCalledWith({
      entryId: 'tte_1',
      classId: 'cls_1',
      subjectId: 'sub_1',
      teacherId: 'stf_1',
      roomId: null,
      periodId: 'per_1',
      day: 'TUESDAY',
    });
  });

  it('moves a lesson onto a period that already holds a different class, letting the server decide', async () => {
    renderPage(<TimetablePage />);

    const lesson = await screen.findByRole('button', { name: /Mathematics/ });
    // Monday/Period 2 already has JSS 1 Silver's English lesson — a different
    // class, teacher and room, so this drop should still be attempted rather
    // than rejected by the UI before it reaches the server.
    const occupant = screen.getByRole('button', { name: /English Language/ });
    const dataTransfer = dataTransferStub();

    fireEvent.dragStart(lesson, { dataTransfer });
    const targetCell = occupant.closest('td')!;
    fireEvent.dragOver(targetCell, { dataTransfer });
    fireEvent.drop(targetCell, { dataTransfer });

    expect(saveMutate).toHaveBeenCalledWith({
      entryId: 'tte_1',
      classId: 'cls_1',
      subjectId: 'sub_1',
      teacherId: 'stf_1',
      roomId: null,
      periodId: 'per_2',
      day: 'MONDAY',
    });
  });

  it('surfaces a clash from the server as a toast instead of silently moving the lesson', async () => {
    saveMutate.mockRejectedValueOnce(
      new ApiError({
        code: ApiErrorCode.Conflict,
        status: 409,
        message: 'Funmilayo Adeyemi already teaches then.',
      }),
    );
    renderPage(<TimetablePage />);

    const lesson = await screen.findByRole('button', { name: /Mathematics/ });
    const target = screen.getByRole('button', { name: 'Add a lesson on Wednesday in Period 1' });
    const dataTransfer = dataTransferStub();

    fireEvent.dragStart(lesson, { dataTransfer });
    const targetCell = target.closest('td')!;
    fireEvent.dragOver(targetCell, { dataTransfer });
    fireEvent.drop(targetCell, { dataTransfer });

    await vi.waitFor(() => expect(saveMutate).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      'That move would clash',
      expect.objectContaining({ description: expect.stringContaining('already teaches') }),
    );
  });

  it('only offers the drag-to-delete target once a lesson is actually being dragged', async () => {
    renderPage(<TimetablePage />);
    await screen.findByRole('button', { name: /Mathematics/ });

    expect(screen.queryByText('Drop here to remove')).not.toBeInTheDocument();
  });

  it('deletes a lesson dragged onto the trash zone, without opening the edit dialog', async () => {
    renderPage(<TimetablePage />);

    const lesson = await screen.findByRole('button', { name: /Mathematics/ });
    const dataTransfer = dataTransferStub();

    fireEvent.dragStart(lesson, { dataTransfer });
    const trash = await screen.findByText('Drop here to remove');
    fireEvent.dragOver(trash, { dataTransfer });
    fireEvent.drop(trash, { dataTransfer });

    expect(deleteMutate).toHaveBeenCalledWith('tte_1');
    expect(saveMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Edit lesson' })).not.toBeInTheDocument();
  });

  /**
   * Choosing a class also clears any teacher filter (and vice versa) so the
   * two selects stay mutually exclusive. That clear used to be a second,
   * separate `setSearchParams` call — which raced the first: both closed over
   * the same pre-click URL, so the second call's result always won and wiped
   * out whatever the first had just set. A class selection would appear to do
   * nothing at all. Both updates now go through in one call.
   */
  it('keeps the class filter when selecting it clears the teacher filter', async () => {
    renderPage(<TimetablePage />);
    await screen.findByRole('button', { name: /Mathematics/ });

    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'cls_1' } });

    await vi.waitFor(() => {
      const lastCall = useCurrentTimetable.mock.calls.at(-1)?.[0];
      expect(lastCall).toMatchObject({ classId: 'cls_1', teacherId: undefined });
    });
  });

  it('keeps the teacher filter when selecting it clears the class filter', async () => {
    renderPage(<TimetablePage />);
    await screen.findByRole('button', { name: /Mathematics/ });

    fireEvent.change(screen.getByLabelText('Teacher'), { target: { value: 'stf_2' } });

    await vi.waitFor(() => {
      const lastCall = useCurrentTimetable.mock.calls.at(-1)?.[0];
      expect(lastCall).toMatchObject({ teacherId: 'stf_2', classId: undefined });
    });
  });

  it('filters by subject alongside a class, rather than clearing it', async () => {
    renderPage(<TimetablePage />);
    await screen.findByRole('button', { name: /Mathematics/ });

    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'cls_1' } });
    await vi.waitFor(() => {
      expect(useCurrentTimetable.mock.calls.at(-1)?.[0]).toMatchObject({ classId: 'cls_1' });
    });

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'sub_2' } });
    await vi.waitFor(() => {
      expect(useCurrentTimetable.mock.calls.at(-1)?.[0]).toMatchObject({
        classId: 'cls_1',
        subjectId: 'sub_2',
      });
    });
  });

  /**
   * Clearing wipes every class's timetable, not just what the current filters
   * show, so it sits behind a typed confirmation rather than a plain click —
   * the same guard the app uses elsewhere for operations with no undo.
   */
  it('requires typing CLEAR before the whole timetable can be wiped', async () => {
    const user = userEvent.setup();
    renderPage(<TimetablePage />);
    await screen.findByRole('button', { name: /Mathematics/ });

    await user.click(screen.getByRole('button', { name: 'Clear timetable' }));

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Clear timetable' });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox'), 'CLEAR');
    expect(confirmButton).not.toBeDisabled();

    await user.click(confirmButton);
    expect(clearMutate).toHaveBeenCalled();
  });

  it('has nothing to clear when the timetable is already empty', async () => {
    useCurrentTimetable.mockReturnValue({
      data: { ...timetable(), entries: [] },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage(<TimetablePage />);
    await screen.findByRole('columnheader', { name: /Monday/ });

    expect(screen.getByRole('button', { name: 'Clear timetable' })).toBeDisabled();
  });
});
