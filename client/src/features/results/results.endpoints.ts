import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  Broadsheet,
  CommentTemplate,
  GradingScheme,
  ReportCard,
  ResultStatus,
  ScoreSheet,
  Transcript,
} from '@/types/results';
import type { ResultAnalytics } from '@/types/analytics';

/** A row in the score-sheet list carries progress instead of every mark. */
export interface ScoreSheetSummary extends Omit<ScoreSheet, 'rows'> {
  rows: [];
  enteredCount: number;
  totalCount: number;
}

export interface ScoreEntry {
  studentId: string;
  componentId: string;
  score: number | null;
}

export interface TransitionScoreSheetInput {
  to: ResultStatus;
  note?: string;
}

export interface ReportCardCommentsInput {
  formTeacherComment?: string;
  principalComment?: string;
}

/**
 * Endpoint layer for results.
 *
 * `saveScores` sends the sheet version as `If-Match`, so if a colleague saved
 * first the server rejects the write instead of quietly overwriting their
 * marks. Issuing a transcript stamps it with a verification code and QR target.
 */
export const ResultsEndpoints = {
  fetchScoreSheets: (query: ListQuery) =>
    http.get<Paginated<ScoreSheetSummary>>('/score-sheets', { query }),

  fetchScoreSheet: (id: string) => http.get<ScoreSheet>(`/score-sheets/${id}`),

  saveScores: (scoreSheetId: string, entries: ScoreEntry[], version: number) =>
    http.patch<ScoreSheet>(`/score-sheets/${scoreSheetId}/scores`, { entries }, { version }),

  /** DRAFT → SUBMITTED → APPROVED → PUBLISHED, each gated by its own permission. */
  transitionScoreSheet: (scoreSheetId: string, input: TransitionScoreSheetInput) =>
    http.post<ScoreSheet>(`/score-sheets/${scoreSheetId}/transition`, input),

  fetchGradingSchemes: () => http.get<GradingScheme[]>('/grading-schemes'),

  createGradingScheme: (values: Partial<GradingScheme>) =>
    http.post<GradingScheme>('/grading-schemes', values),

  updateGradingScheme: (id: string, values: Partial<GradingScheme>) =>
    http.patch<GradingScheme>(`/grading-schemes/${id}`, values),

  fetchReportCard: (studentId: string, termId: string) =>
    http.get<ReportCard>(`/report-cards/${studentId}/${termId}`),

  saveReportCardComments: (studentId: string, termId: string, values: ReportCardCommentsInput) =>
    http.patch<ReportCard>(`/report-cards/${studentId}/${termId}`, values),

  fetchAnalytics: (termId?: string) =>
    http.get<ResultAnalytics>('/analytics/results', { query: { termId } }),

  fetchBroadsheet: (classId: string, termId: string) =>
    http.get<Broadsheet>('/broadsheet', { query: { classId, termId } }),

  fetchCommentTemplates: () => http.get<CommentTemplate[]>('/comment-templates'),

  createCommentTemplate: (values: Partial<CommentTemplate>) =>
    http.post<CommentTemplate>('/comment-templates', values),

  fetchTranscript: (studentId: string) => http.get<Transcript>(`/transcripts/${studentId}`),

  issueTranscript: (studentId: string) =>
    http.post<Transcript>(`/transcripts/${studentId}/issue`),
};
