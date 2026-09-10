import type { AcademicSession, Term } from '@/types/academics';

/**
 * Query and payload shapes shared by the academics endpoint files.
 *
 * The query types are aliases rather than interfaces so they keep the implicit
 * index signature the transport's `Record<string, unknown>` parameter needs.
 */

export type ClassQuery = {
  levelId?: string;
  includeInactive?: boolean;
  formTeacherOnly?: boolean;
};

export type SubjectQuery = { levelId?: string; classId?: string };

/** A session may be created together with its terms in one call. */
export type SessionPayload = Partial<AcademicSession> & { terms?: Partial<Term>[] };
