import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  AttemptResult,
  CbtAssessment,
  CbtAttempt,
  Question,
} from '@/types/assessment';

export function useQuestions(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.cbt.questions(schoolId, query),
    queryFn: () => http.get<Paginated<Question>>('/questions', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useSaveQuestion() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<Question> }) =>
      id ? http.patch<Question>(`/questions/${id}`, values) : http.post<Question>('/questions', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cbt.questions(schoolId) });
      toast.success('Question saved');
    },
  });
}

export function useDeleteQuestion() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => http.delete<void>(`/questions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cbt.questions(schoolId) });
      toast.success('Question removed');
    },
  });
}

export function useAssessments(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.cbt.assessments(schoolId, query),
    queryFn: () => http.get<Paginated<CbtAssessment>>('/assessments', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useAssessment(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.cbt.assessment(schoolId, id ?? ''),
    queryFn: () => http.get<CbtAssessment>(`/assessments/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

export function useSaveAssessment() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<CbtAssessment> }) =>
      id
        ? http.patch<CbtAssessment>(`/assessments/${id}`, values)
        : http.post<CbtAssessment>('/assessments', values),
    onSuccess: (assessment) => {
      queryClient.setQueryData(queryKeys.cbt.assessment(schoolId, assessment.id), assessment);
      void queryClient.invalidateQueries({ queryKey: queryKeys.cbt.assessments(schoolId) });
      toast.success('Assessment saved');
    },
  });
}

/** Starting an attempt returns the paper with correct answers stripped out. */
export function useStartAttempt(assessmentId: string) {
  return useMutation({
    mutationFn: () => http.post<CbtAttempt>(`/assessments/${assessmentId}/attempts`),
  });
}

/**
 * Flushing answers as the student works.
 *
 * Called on a short timer while an exam is in progress so a dropped connection
 * costs seconds, not an entire paper. Failures here are deliberately silent —
 * the authoritative copy is in this device's storage until submission, and an
 * error toast mid-exam would only frighten a child (spec section 18).
 */
export function useFlushAnswers(attemptId: string) {
  return useMutation({
    mutationFn: (answers: { questionId: string; answer: string }[]) =>
      http.post<{ saved: number; savedAt: string }>(`/attempts/${attemptId}/answers`, { answers }),
    retry: false,
    onError: () => {
      /* Silent: the local copy is authoritative until submit succeeds. */
    },
  });
}

export function useSubmitAttempt(attemptId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      assessmentId: string;
      answers: { questionId: string; answer: string | null }[];
    }) => http.post<AttemptResult>(`/attempts/${attemptId}/submit`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cbt.assessments(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.student(schoolId) });
    },
  });
}
