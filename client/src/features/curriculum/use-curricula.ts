import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { Curriculum, CurriculumTopic, LearningObjective } from '@/types/curriculum';
import { CurriculumEndpoints } from './curriculum.endpoints';
import type { CurriculumQuery } from './curriculum.endpoints';

/** The curriculum itself: the subject-and-class shell, its topics and their objectives. */

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
