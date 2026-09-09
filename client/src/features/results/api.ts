import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { outbox } from '@/lib/outbox';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { GradingScheme, CommentTemplate, ResultStatus, ScoreSheet } from '@/types/results';
import { ResultsEndpoints } from './results.endpoints';
import type {
  ReportCardCommentsInput,
  ScoreEntry,
  ScoreSheetSummary,
  TransitionScoreSheetInput,
} from './results.endpoints';

export type { ReportCardCommentsInput, ScoreEntry, ScoreSheetSummary, TransitionScoreSheetInput };

export function useScoreSheets(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.scoreSheets(schoolId, query),
    queryFn: () => ResultsEndpoints.fetchScoreSheets(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useScoreSheet(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.scoreSheet(schoolId, id ?? ''),
    queryFn: () => ResultsEndpoints.fetchScoreSheet(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

/**
 * Saving marks.
 *
 * Like attendance, this is a workflow a teacher cannot easily redo, so a
 * connectivity failure queues the write rather than losing an hour of typing.
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
        return await ResultsEndpoints.saveScores(scoreSheetId, input.entries, input.version);
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
    mutationFn: (input: TransitionScoreSheetInput) =>
      ResultsEndpoints.transitionScoreSheet(scoreSheetId, input),
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
    queryFn: () => ResultsEndpoints.fetchGradingSchemes(),
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
        ? ResultsEndpoints.updateGradingScheme(id, values)
        : ResultsEndpoints.createGradingScheme(values),
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
    queryFn: () => ResultsEndpoints.fetchReportCard(studentId ?? '', termId ?? ''),
    enabled: Boolean(schoolId && studentId && termId),
  });
}

export function useResultAnalytics(termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.analytics(schoolId, termId),
    queryFn: () => ResultsEndpoints.fetchAnalytics(termId),
    enabled: Boolean(schoolId),
  });
}

export function useBroadsheet(classId: string | undefined, termId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.broadsheet(schoolId, classId ?? '', termId ?? ''),
    queryFn: () => ResultsEndpoints.fetchBroadsheet(classId ?? '', termId ?? ''),
    enabled: Boolean(schoolId && classId && termId),
  });
}

export function useCommentTemplates() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.results.comments(schoolId),
    queryFn: () => ResultsEndpoints.fetchCommentTemplates(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useSaveCommentTemplate() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<CommentTemplate>) =>
      ResultsEndpoints.createCommentTemplate(values),
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
    mutationFn: (values: ReportCardCommentsInput) =>
      ResultsEndpoints.saveReportCardComments(studentId, termId, values),
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
    queryFn: () => ResultsEndpoints.fetchTranscript(studentId ?? ''),
    enabled: Boolean(schoolId && studentId),
  });
}

/** Issuing stamps the transcript with a verification code and QR target. */
export function useIssueTranscript(studentId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ResultsEndpoints.issueTranscript(studentId),
    onSuccess: (transcript) => {
      queryClient.setQueryData(queryKeys.results.transcript(schoolId, studentId), transcript);
      toast.success('Transcript issued', { description: transcript.verificationCode });
    },
  });
}
