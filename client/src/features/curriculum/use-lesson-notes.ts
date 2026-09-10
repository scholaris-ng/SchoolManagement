import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { LessonNote } from '@/types/curriculum';
import { CurriculumEndpoints } from './curriculum.endpoints';

/** Lesson notes and their review workflow. */

export function useLessonNotes(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.lessonNotes(schoolId, query),
    queryFn: () => CurriculumEndpoints.fetchLessonNotes(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useLessonNote(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.lessonNote(schoolId, id ?? ''),
    queryFn: () => CurriculumEndpoints.fetchLessonNote(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

export function useSaveLessonNote(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<LessonNote>; version?: number }) =>
      id
        ? CurriculumEndpoints.updateLessonNote(id, values, version)
        : CurriculumEndpoints.createLessonNote(values),
    onSuccess: (note) => {
      queryClient.setQueryData(queryKeys.curriculum.lessonNote(schoolId, note.id), note);
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.lessonNotes(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      const message: Record<LessonNote['status'], string> = {
        DRAFT: 'Lesson note saved',
        SUBMITTED: 'Lesson note submitted for review',
        APPROVED: 'Lesson note approved',
        RETURNED: 'Lesson note returned to the teacher',
      };
      toast.success(message[note.status]);
    },
  });
}

export function useDeleteLessonNote() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CurriculumEndpoints.removeLessonNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.lessonNotes(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      toast.success('Lesson note deleted');
    },
  });
}

export function useBulkDeleteLessonNotes() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => CurriculumEndpoints.bulkDeleteLessonNotes(ids),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.lessonNotes(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      toast.success(`${result.deleted} lesson note${result.deleted === 1 ? '' : 's'} deleted`);
    },
  });
}
