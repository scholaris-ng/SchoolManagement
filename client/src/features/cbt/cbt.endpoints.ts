import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { AttemptResult, CbtAssessment, CbtAttempt, Question } from '@/types/assessment';

export interface SubmitAttemptInput {
  assessmentId: string;
  answers: { questionId: string; answer: string | null }[];
}

export interface FlushAnswersResult {
  saved: number;
  savedAt: string;
}

/** Endpoint layer for the question bank and computer-based tests. */
export const CbtEndpoints = {
  fetchQuestions: (query: ListQuery) => http.get<Paginated<Question>>('/questions', { query }),

  createQuestion: (values: Partial<Question>) => http.post<Question>('/questions', values),

  updateQuestion: (id: string, values: Partial<Question>) =>
    http.patch<Question>(`/questions/${id}`, values),

  removeQuestion: (id: string) => http.delete<void>(`/questions/${id}`),

  fetchAssessments: (query: ListQuery) =>
    http.get<Paginated<CbtAssessment>>('/assessments', { query }),

  fetchAssessment: (id: string) => http.get<CbtAssessment>(`/assessments/${id}`),

  createAssessment: (values: Partial<CbtAssessment>) =>
    http.post<CbtAssessment>('/assessments', values),

  updateAssessment: (id: string, values: Partial<CbtAssessment>) =>
    http.patch<CbtAssessment>(`/assessments/${id}`, values),

  /** Starting an attempt returns the paper with correct answers stripped out. */
  startAttempt: (assessmentId: string) =>
    http.post<CbtAttempt>(`/assessments/${assessmentId}/attempts`),

  flushAnswers: (attemptId: string, answers: { questionId: string; answer: string }[]) =>
    http.post<FlushAnswersResult>(`/attempts/${attemptId}/answers`, { answers }),

  submitAttempt: (attemptId: string, input: SubmitAttemptInput) =>
    http.post<AttemptResult>(`/attempts/${attemptId}/submit`, input),
};
