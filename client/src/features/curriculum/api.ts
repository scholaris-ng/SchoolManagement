import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  Curriculum,
  CurriculumCoverage,
  CurriculumTopic,
  LearningObjective,
  LessonNote,
  SchemeOfWork,
} from '@/types/curriculum';

/** The scheme list omits the weeks; only the detail view needs them. */
export interface SchemeSummary extends Omit<SchemeOfWork, 'weeks'> {
  weeks: [];
  weekCount: number;
}

export function useCurricula(
  query: {
    subjectId?: string;
    levelId?: string;
    classId?: string;
    /**
     * Omit to get the school's current session, which is what almost every
     * caller wants. Pass `'ALL'` to look across previous years.
     */
    sessionId?: string;
    /** Narrows the list to one author — "written by me". */
    createdById?: string;
  } = {},
) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.list(schoolId, query),
    queryFn: () => http.get<Curriculum[]>('/curricula', { query }),
    enabled: Boolean(schoolId),
  });
}

/**
 * Creates or edits a curriculum — the subject-and-class shell that topics and
 * objectives are built inside. Nothing is pre-loaded: a school defines its own
 * curricula from here before scheme generation or coverage tracking has
 * anything to work with.
 *
 * The server stamps the author and derives the level from the class, so
 * neither is sent.
 */
export function useSaveCurriculum() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<Curriculum> }) =>
      id
        ? http.patch<Curriculum>(`/curricula/${id}`, values)
        : http.post<Curriculum>('/curricula', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.list(schoolId) });
      toast.success('Curriculum saved');
    },
  });
}

export function useDeleteCurriculum() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => http.delete<void>(`/curricula/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.list(schoolId) });
      toast.success('Curriculum deleted');
    },
  });
}

export function useCurriculumTopics(curriculumId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.topics(schoolId, curriculumId ?? ''),
    queryFn: () => http.get<CurriculumTopic[]>(`/curricula/${curriculumId}/topics`),
    enabled: Boolean(schoolId && curriculumId),
  });
}

export function useSaveTopic(curriculumId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<CurriculumTopic> }) =>
      id
        ? http.patch<CurriculumTopic>(`/curricula/${curriculumId}/topics/${id}`, values)
        : http.post<CurriculumTopic>(`/curricula/${curriculumId}/topics`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.curriculum.topics(schoolId, curriculumId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.list(schoolId) });
      toast.success('Topic saved');
    },
  });
}

export function useDeleteTopic(curriculumId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (topicId: string) =>
      http.delete<void>(`/curricula/${curriculumId}/topics/${topicId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.curriculum.topics(schoolId, curriculumId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.list(schoolId) });
      toast.success('Topic deleted');
    },
  });
}

export function useSaveObjective(curriculumId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      topicId,
      id,
      values,
    }: {
      topicId: string;
      id?: string;
      values: Partial<LearningObjective>;
    }) =>
      id
        ? http.patch<LearningObjective>(
            `/curricula/${curriculumId}/topics/${topicId}/objectives/${id}`,
            values,
          )
        : http.post<LearningObjective>(
            `/curricula/${curriculumId}/topics/${topicId}/objectives`,
            values,
          ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.curriculum.topics(schoolId, curriculumId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.list(schoolId) });
      toast.success('Objective saved');
    },
  });
}

export function useDeleteObjective(curriculumId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topicId, objectiveId }: { topicId: string; objectiveId: string }) =>
      http.delete<void>(`/curricula/${curriculumId}/topics/${topicId}/objectives/${objectiveId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.curriculum.topics(schoolId, curriculumId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.list(schoolId) });
      toast.success('Objective deleted');
    },
  });
}

export function useCurriculumCoverage(query: { curriculumId?: string; classId?: string } = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.coverage(schoolId, query),
    queryFn: () => http.get<CurriculumCoverage>('/curriculum-coverage', { query }),
    enabled: Boolean(schoolId && query.curriculumId),
  });
}

/**
 * Marking objective coverage — taught, assessed, or both.
 *
 * This is the entry point for the coverage analytics: a school can only find
 * the gap between "on the syllabus," "actually taught" and "actually tested"
 * if a teacher can record each difference in a couple of clicks (spec section
 * 13). The server enforces that an objective cannot be assessed without
 * being taught, so unmarking "taught" clears "assessed" with it.
 */
export function useMarkObjectiveCoverage(curriculumId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { objectiveIds: string[]; taught?: boolean; assessed?: boolean }) =>
      http.post<{ updated: number }>(`/curricula/${curriculumId}/coverage`, input),
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.curriculum.topics(schoolId, curriculumId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.coverage(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      const count = `${result.updated} objective${result.updated === 1 ? '' : 's'}`;
      const label =
        input.taught !== undefined
          ? input.taught
            ? 'taught'
            : 'not taught'
          : input.assessed
            ? 'assessed'
            : 'not assessed';
      toast.success(`${count} marked as ${label}`);
    },
  });
}

/* -- Schemes of work -------------------------------------------------------- */

export function useSchemes(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.schemes(schoolId, query),
    queryFn: () => http.get<Paginated<SchemeSummary>>('/schemes', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useScheme(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.scheme(schoolId, id ?? ''),
    queryFn: () => http.get<SchemeOfWork>(`/schemes/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

/**
 * Generates a *draft* scheme from the curriculum and the term's real teaching
 * weeks. It is explicitly a starting point — the teacher reorders and edits it
 * before submitting, and nothing about the generated plan is fixed (spec §14).
 */
export function useGenerateScheme() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { curriculumId: string; classId: string; termId: string }) =>
      http.post<SchemeOfWork>('/schemes/generate', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.schemes(schoolId) });
      toast.success('Draft scheme generated', {
        description: 'Review and adjust it before submitting for approval.',
      });
    },
  });
}

export function useSaveScheme(id: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<SchemeOfWork>; version: number }) =>
      http.patch<SchemeOfWork>(`/schemes/${id}`, values, { version }),
    onSuccess: (scheme) => {
      queryClient.setQueryData(queryKeys.curriculum.scheme(schoolId, id), scheme);
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.schemes(schoolId) });
      toast.success(
        scheme.status === 'APPROVED' ? 'Scheme approved' : 'Scheme of work saved',
      );
    },
  });
}

/* -- Lesson notes ----------------------------------------------------------- */

export function useLessonNotes(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.lessonNotes(schoolId, query),
    queryFn: () => http.get<Paginated<LessonNote>>('/lesson-notes', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useLessonNote(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.lessonNote(schoolId, id ?? ''),
    queryFn: () => http.get<LessonNote>(`/lesson-notes/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

export function useSaveLessonNote(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<LessonNote>; version?: number }) =>
      id
        ? http.patch<LessonNote>(`/lesson-notes/${id}`, values, { version })
        : http.post<LessonNote>('/lesson-notes', values),
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
