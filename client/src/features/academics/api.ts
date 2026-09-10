/**
 * Public surface of the academics module.
 *
 * The hooks live in sibling files split by what they do — reads, writes and
 * picker options — so no one file outgrows the limit in section 17 of the
 * frontend guide. This barrel keeps a single import path for callers.
 */
export type { ClassQuery, SessionPayload, SubjectQuery } from './academics.endpoints';
export { AcademicsEndpoints } from './academics.endpoints';
export * from './use-academics';
export * from './use-calendar-structure';
export * from './use-teaching-resources';
export * from './use-academics-options';
