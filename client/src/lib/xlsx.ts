/**
 * Excel (.xlsx) helpers.
 *
 * Split into reading and writing so neither file outgrows the limit in section
 * 17 of the frontend guide. This barrel keeps a single import path for callers.
 */
export { XLSX_MIME_TYPE } from './xlsx-engine';
export * from './xlsx-export';
export * from './xlsx-import';
