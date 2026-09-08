import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { outbox } from '@/lib/outbox';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
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

export function useScoreSheets(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.scoreSheets(schoolId, query),
    queryFn: () => http.get<Paginated<ScoreSheetSummary>>('/score-sheets', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useScoreSheet(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.scoreSheet(schoolId, id ?? ''),
    queryFn: () => http.get<ScoreSheet>(`/score-sheets/${id}`),
    enabled: Boolean(schoolId && id),
  });
}

export interface ScoreEntry {
  studentId: string;
  componentId: string;
  score: number | null;
}

/**
 * Saving marks.
 *
 * Like attendance, this is a workflow a teacher cannot easily redo, so a
 * connectivity failure queues the write rather than losing an hour of typing.
 * The sheet version travels as `If-Match`, so if a colleague saved first the
 * server rejects the write instead of quietly overwriting their marks.
 */
export function useSaveScores(scoreSheetId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      entries: ScoreEntry[];
      version: number;
      label: string;
    }): Promise<ScoreSheet | 'queued'> => {
      try {
        return await http.patch<ScoreSheet>(
          `/score-sheets/${scoreSheetId}/scores`,
          { entries: input.entries },
          { version: input.version },
        );
      } catch (error) {
        const offline =
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? true
            : (error as { isOffline?: boolean }).isOffline === true;
        if (!offline) throw error;

        outbox.enqueue({
          label: `Scores — ${input.label}`,
          method: 'PATCH',
          path: `/score-sheets/${scoreSheetId}/scores`,
          body: { entries: input.entries },
          dedupeKey: `scores:${scoreSheetId}`,
          schoolId,
          invalidate: [queryKeys.results.scoreSheet(schoolId, scoreSheetId) as string[]],
        });
        return 'queued';
      }
    },
    onSuccess: (result) => {
      if (result === 'queued') {
        toast.warning('Saved on this device only', {
          description: 'You are offline. These marks will sync when the connection returns.',
        });
        return;
      }
      queryClient.setQueryData(queryKeys.results.scoreSheet(schoolId, scoreSheetId), result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.results.scoreSheets(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.teacher(schoolId) });
      toast.success('Scores saved');
    },
  });
}

/** DRAFT → SUBMITTED → APPROVED → PUBLISHED, each gated by its own permission. */
export function useTransitionScoreSheet(scoreSheetId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { to: ResultStatus; note?: string }) =>
      http.post<ScoreSheet>(`/score-sheets/${scoreSheetId}/transition`, input),
    onSuccess: (sheet) => {
      queryClient.setQueryData(queryKeys.results.scoreSheet(schoolId, scoreSheetId), sheet);
      void queryClient.invalidateQueries({ queryKey: queryKeys.results.scoreSheets(schoolId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.results.analytics(schoolId) });
      const message: Record<ResultStatus, string> = {
        DRAFT: 'Returned to the teacher for correction',
        SUBMITTED: 'Submitted for approval',
        APPROVED: 'Results approved',
        PUBLISHED: 'Results published to parents',
      };
      toast.success(message[sheet.status]);
    },
  });
}

export function useGradingSchemes() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.schemes(schoolId),
    queryFn: () => http.get<GradingScheme[]>('/grading-schemes'),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useSaveGradingScheme() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<GradingScheme> }) =>
      id
        ? http.patch<GradingScheme>(`/grading-schemes/${id}`, values)
        : http.post<GradingScheme>('/grading-schemes', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.results.schemes(schoolId) });
      toast.success('Grading scheme saved');
    },
  });
}

export function useReportCard(studentId: string | undefined, termId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.reportCard(schoolId, studentId ?? '', termId ?? ''),
    queryFn: () => http.get<ReportCard>(`/report-cards/${studentId}/${termId}`),
    enabled: Boolean(schoolId && studentId && termId),
  });
}

export function useResultAnalytics(termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.analytics(schoolId, termId),
    queryFn: () => http.get<ResultAnalytics>('/analytics/results', { query: { termId } }),
    enabled: Boolean(schoolId),
  });
}

export function useBroadsheet(classId: string | undefined, termId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.broadsheet(schoolId, classId ?? '', termId ?? ''),
    queryFn: () => http.get<Broadsheet>('/broadsheet', { query: { classId, termId } }),
    enabled: Boolean(schoolId && classId && termId),
  });
}

export function useCommentTemplates() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.comments(schoolId),
    queryFn: () => http.get<CommentTemplate[]>('/comment-templates'),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useSaveCommentTemplate() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<CommentTemplate>) =>
      http.post<CommentTemplate>('/comment-templates', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.results.comments(schoolId) });
      toast.success('Comment template saved');
    },
  });
}

export function useSaveReportCardComments(studentId: string, termId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: { formTeacherComment?: string; principalComment?: string }) =>
      http.patch<ReportCard>(`/report-cards/${studentId}/${termId}`, values),
    onSuccess: (card) => {
      queryClient.setQueryData(queryKeys.results.reportCard(schoolId, studentId, termId), card);
      toast.success('Comments saved');
    },
  });
}

export function useTranscript(studentId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.transcript(schoolId, studentId ?? ''),
    queryFn: () => http.get<Transcript>(`/transcripts/${studentId}`),
    enabled: Boolean(schoolId && studentId),
  });
}

/** Issuing stamps the transcript with a verification code and QR target. */
export function useIssueTranscript(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => http.post<Transcript>(`/transcripts/${studentId}/issue`),
    onSuccess: (transcript) => {
      queryClient.setQueryData(queryKeys.results.transcript(schoolId, studentId), transcript);
      toast.success('Transcript issued', { description: transcript.verificationCode });
    },
  });
}
