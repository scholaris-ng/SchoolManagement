import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type {
  Curriculum,
  CurriculumTopic,
  LearningObjective,
  LessonNote,
  SchemeOfWork,
} from '@/types/curriculum';
import { CurriculumEndpoints } from './curriculum.endpoints';
import type {
  CoverageQuery,
  CurriculumQuery,
  GenerateSchemeInput,
  MarkCoverageInput,
  SchemeSummary,
} from './curriculum.endpoints';

export type { CoverageQuery, CurriculumQuery, GenerateSchemeInput, MarkCoverageInput, SchemeSummary };

export function useCurricula(query: CurriculumQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.list(schoolId, query),
    queryFn: () => CurriculumEndpoints.fetchAll(query),
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
      id ? CurriculumEndpoints.update(id, values) : CurriculumEndpoints.create(values),
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
    mutationFn: (id: string) => CurriculumEndpoints.remove(id),
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
    queryFn: () => CurriculumEndpoints.fetchTopics(curriculumId ?? ''),
    enabled: Boolean(schoolId && curriculumId),
  });
}

export function useSaveTopic(curriculumId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<CurriculumTopic> }) =>
      id
        ? CurriculumEndpoints.updateTopic(curriculumId, id, values)
        : CurriculumEndpoints.createTopic(curriculumId, values),
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
    mutationFn: (topicId: string) => CurriculumEndpoints.removeTopic(curriculumId, topicId),
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
        ? CurriculumEndpoints.updateObjective(curriculumId, topicId, id, values)
        : CurriculumEndpoints.createObjective(curriculumId, topicId, values),
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
      CurriculumEndpoints.removeObjective(curriculumId, topicId, objectiveId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.curriculum.topics(schoolId, curriculumId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.list(schoolId) });
      toast.success('Objective deleted');
    },
  });
}

export function useCurriculumCoverage(query: CoverageQuery = {}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.coverage(schoolId, query),
    queryFn: () => CurriculumEndpoints.fetchCoverage(query),
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
    mutationFn: (input: MarkCoverageInput) =>
      CurriculumEndpoints.markCoverage(curriculumId, input),
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
    queryFn: () => CurriculumEndpoints.fetchSchemes(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useScheme(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.curriculum.scheme(schoolId, id ?? ''),
    queryFn: () => CurriculumEndpoints.fetchScheme(id ?? ''),
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
    mutationFn: (input: GenerateSchemeInput) => CurriculumEndpoints.generateScheme(input),
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
      CurriculumEndpoints.updateScheme(id, values, version),
    onSuccess: (scheme) => {
      queryClient.setQueryData(queryKeys.curriculum.scheme(schoolId, id), scheme);
      void queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.schemes(schoolId) });
      toast.success(scheme.status === 'APPROVED' ? 'Scheme approved' : 'Scheme of work saved');
    },
  });
}

/* -- Lesson notes ----------------------------------------------------------- */

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
