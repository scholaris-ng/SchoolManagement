/**
 * Public surface of the curriculum module.
 *
 * The hooks live in sibling files split by sub-feature — curricula, coverage,
 * schemes of work and lesson notes — so no one file outgrows the limit in
 * section 17 of the frontend guide. This barrel keeps a single import path.
 */
export type {
  CoverageQuery,
  CurriculumQuery,
  GenerateSchemeInput,
  MarkCoverageInput,
  SchemeSummary,
} from './curriculum.endpoints';
export { CurriculumEndpoints } from './curriculum.endpoints';
export * from './use-curricula';
export * from './use-coverage';
export * from './use-schemes';
export * from './use-lesson-notes';
