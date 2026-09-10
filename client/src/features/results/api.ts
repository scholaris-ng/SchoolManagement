/**
 * Public surface of the results module.
 *
 * The hooks live in sibling files split by sub-feature — score sheets, grading
 * and the documents families receive — so no one file outgrows the limit in
 * section 17 of the frontend guide. This barrel keeps a single import path.
 */
export type {
  ReportCardCommentsInput,
  ScoreEntry,
  ScoreSheetSummary,
  TransitionScoreSheetInput,
} from './results.endpoints';
export { ResultsEndpoints } from './results.endpoints';
export * from './use-score-sheets';
export * from './use-grading';
export * from './use-report-cards';
