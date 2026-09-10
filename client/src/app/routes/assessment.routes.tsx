import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guarded } from './guarded';

/**
 * Score entry, results, report cards, transcripts and computer-based tests.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

/* -- Assessment ------------------------------------------------------------ */
const ScoreEntryPage = lazy(() =>
  import('@/features/results/score-entry-page').then((m) => ({ default: m.ScoreEntryPage })),
);
const ScoreSheetPage = lazy(() =>
  import('@/features/results/score-sheet-page').then((m) => ({ default: m.ScoreSheetPage })),
);
const ResultsPage = lazy(() =>
  import('@/features/results/results-page').then((m) => ({ default: m.ResultsPage })),
);
const ReportCardsPage = lazy(() =>
  import('@/features/results/report-cards-page').then((m) => ({ default: m.ReportCardsPage })),
);
const ReportCardPage = lazy(() =>
  import('@/features/results/report-card-page').then((m) => ({ default: m.ReportCardPage })),
);
const TranscriptsPage = lazy(() =>
  import('@/features/results/transcripts-page').then((m) => ({ default: m.TranscriptsPage })),
);
const TranscriptPage = lazy(() =>
  import('@/features/results/transcript-page').then((m) => ({ default: m.TranscriptPage })),
);
const QuestionBankPage = lazy(() =>
  import('@/features/cbt/question-bank-page').then((m) => ({ default: m.QuestionBankPage })),
);
const AssessmentsPage = lazy(() =>
  import('@/features/cbt/assessments-page').then((m) => ({ default: m.AssessmentsPage })),
);
const AssessmentDetailPage = lazy(() =>
  import('@/features/cbt/assessment-detail-page').then((m) => ({
    default: m.AssessmentDetailPage,
  })),
);
const AttemptPage = lazy(() =>
  import('@/features/cbt/attempt-page').then((m) => ({ default: m.AttemptPage })),
);

/* -- Finance --------------------------------------------------------------- */

export const assessmentRoutes: RouteObject[] = [
  {
    element: guarded('result.enter'),
    children: [
      { path: 'results/entry', element: <ScoreEntryPage /> },
      { path: 'results/entry/:id', element: <ScoreSheetPage /> },
    ],
  },
  {
    element: guarded('result.read'),
    children: [{ path: 'results', element: <ResultsPage /> }],
  },
  {
    element: guarded('reportcard.read'),
    children: [
      { path: 'report-cards', element: <ReportCardsPage /> },
      { path: 'report-cards/:studentId/:termId', element: <ReportCardPage /> },
    ],
  },
  {
    element: guarded('transcript.read'),
    children: [
      { path: 'transcripts', element: <TranscriptsPage /> },
      { path: 'transcripts/:studentId', element: <TranscriptPage /> },
    ],
  },
  {
    element: guarded('question.manage'),
    children: [{ path: 'cbt/questions', element: <QuestionBankPage /> }],
  },
  {
    element: guarded({ anyOf: ['cbt.read', 'cbt.take'] }),
    children: [
      { path: 'cbt', element: <AssessmentsPage /> },
      { path: 'cbt/attempts/:attemptId', element: <AttemptPage /> },
      { path: 'cbt/:id', element: <AssessmentDetailPage /> },
    ],
  },
];
