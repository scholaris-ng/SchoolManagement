import {
  academicScope,
  db,
  scopeAllows,
  type RequestContext,
} from '../context';
import type {
  Curriculum,
  LessonNote,
  SchemeOfWork,
} from '@/types/curriculum';

/**
 * Helpers shared by the academic mock handlers.
 *
 * They encode the same authorship and scoping rules the real API is specified
 * to enforce, so a teacher editing another teacher’s scheme is refused here
 * exactly as it would be in production.
 */

export const base = '/api/v1';
let sequence = 800_000;
export const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Keeps a curriculum's denormalised topic/objective counts in sync with its topics. */
export function recalcCurriculumCounts(curriculumId: string): void {
  const curriculum = db.curricula.find((entry) => entry.id === curriculumId);
  if (!curriculum) return;
  const topics = db.topics.filter((topic) => topic.curriculumId === curriculumId);
  curriculum.topicCount = topics.length;
  curriculum.objectiveCount = topics.reduce((total, topic) => total + topic.objectives.length, 0);
}

/** A readable label for whoever wrote a curriculum: "Form teacher", "Principal". */
export function roleLabel(context: RequestContext): string {
  const name = context.membership.roles[0] ?? context.membership.customRoleNames[0];
  if (!name) return 'Staff';
  const words = name.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Whether this caller may change an existing curriculum.
 *
 * Coordinators (anyone who may edit the academic structure) own all of them.
 * A teacher owns the ones they wrote, and may also maintain one written for a
 * class and subject they are currently assigned — a colleague going on leave
 * must not freeze that class's syllabus.
 */
export function canEditCurriculum(context: RequestContext, curriculum: Curriculum): boolean {
  if (context.can('academics.manage')) return true;
  if (curriculum.createdById === context.user.id) return true;
  return scopeAllows(academicScope(context), {
    classId: curriculum.classId,
    subjectId: curriculum.subjectId,
  });
}

export const NOT_YOURS =
  'This curriculum belongs to another teacher. Ask a coordinator if it needs to change.';

/**
 * Whether this caller may see or change a scheme of work — the same rule as
 * a curriculum: wrote it, or is currently assigned to teach its class and
 * subject. A scheme is generated *from* a curriculum but tracked as its own
 * record with its own author, so it needs its own check rather than
 * borrowing the curriculum's.
 */
export function canEditScheme(context: RequestContext, scheme: SchemeOfWork): boolean {
  if (context.can('academics.manage')) return true;
  if (scheme.createdById === context.user.id) return true;
  return scopeAllows(academicScope(context), {
    classId: scheme.classId,
    subjectId: scheme.subjectId,
  });
}

export const SCHEME_NOT_YOURS =
  'This scheme of work belongs to another teacher. Ask a coordinator if it needs to change.';

/**
 * Whether this caller may see or change a lesson note.
 *
 * Unlike a curriculum or a scheme of work — shared planning documents a
 * colleague may need to take over — a lesson note is one teacher's personal
 * record of what they actually taught that day. Teaching the same class and
 * subject somewhere else does not entitle a teacher to read a colleague's
 * daily log of it, so this deliberately does not fall back to
 * `academicScope`/`scopeAllows` the way curricula and schemes do: it is
 * "your own" or "you review these," full stop.
 */
export function canEditLessonNote(context: RequestContext, note: LessonNote): boolean {
  if (context.can('academics.manage')) return true;
  if (context.can('lessonnote.approve')) return true;
  return note.teacherId === context.membership.staffId;
}

export const LESSON_NOTE_NOT_YOURS =
  'This lesson note belongs to another teacher. Ask a coordinator if it needs to change.';
