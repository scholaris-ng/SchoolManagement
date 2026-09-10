import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { CommentTemplate } from '@/types/results';
import { ResultsEndpoints } from './results.endpoints';
import type { ReportCardCommentsInput } from './results.endpoints';

/** What a family actually receives: report cards, broadsheets and transcripts. */

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
