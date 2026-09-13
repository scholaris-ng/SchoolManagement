import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService, scopeAllows } from '../../academics/services/academicScope.service';
import { CurriculumRepository } from '../repositories/curriculum.repository';
import { SchemeRepository } from '../repositories/scheme.repository';
import type { CurriculumTopicDTO } from '../dto/curriculum.dto';
import type { LessonNoteDTO, SchemeOfWorkDTO, SchemeSummaryDTO, SchemeWeekDTO } from '../dto/scheme.dto';
import type { TermDTO } from '../../academics/dto/academics.dto';
import type {
  CreateLessonNoteInput,
  FetchLessonNotesQuery,
  FetchSchemesQuery,
  GenerateSchemeInput,
  UpdateLessonNoteInput,
  UpdateSchemeInput,
} from '../validators/curriculum.schema';

const MAX_WEEKS = 30;

/**
 * Schemes of work and lesson notes (spec sections 14 and 15).
 *
 * A scheme is generated, never typed from scratch: the curriculum's topics
 * are spread across the term's real weeks in proportion to how long each was
 * meant to take, and the teacher then reorders and edits that draft. Approval
 * freezes it. A lesson note hangs off one week of an approved-or-not scheme,
 * copies that week's topic and objectives in, and records what the teacher
 * actually did — including what went wrong, which is the part a head teacher
 * reads.
 *
 * Visibility follows the curriculum's: a teacher sees the schemes for the
 * pairs they teach or wrote, and their own notes; an approver sees every note.
 */
export class SchemeService {
  static Instance = new SchemeService();

  private constructor(
    private readonly schemes = SchemeRepository.Instance,
    private readonly curricula = CurriculumRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /* -- Schemes --------------------------------------------------------------- */

  async fetchSchemes(context: RequestContext, query: FetchSchemesQuery): Promise<Paginated<SchemeSummaryDTO>> {
    const scope = await this.scope.forContext(context);
    return this.schemes.fetchPaginated(context.schoolId, {
      ...query,
      visibility: { pairs: scope.pairs, authorUserId: context.user.id },
    });
  }

  async fetchScheme(context: RequestContext, id: string): Promise<SchemeOfWorkDTO> {
    return this.resolveVisible(context, id);
  }

  /**
   * A draft from the curriculum and the term's dates. Topics take their
   * suggested weeks when the term has room, and are squeezed proportionally
   * (never below a week each) when it does not; weeks left over become
   * revision. A topic's objectives are split across the weeks it spans.
   */
  async generateScheme(context: RequestContext, input: GenerateSchemeInput): Promise<SchemeOfWorkDTO> {
    const { schoolId } = context;
    const [curriculum, term, scope] = await Promise.all([
      this.curricula.findOneDTO(schoolId, input.curriculumId),
      this.terms.findOneDTO(schoolId, input.termId),
      this.scope.forContext(context),
    ]);
    if (!curriculum) throw AppError.notFound('Curriculum');
    if (!term) throw AppError.notFound('Term');
    if (curriculum.classId !== input.classId) {
      throw AppError.validation(`That curriculum was written for ${curriculum.className}, not the class chosen.`);
    }
    if (!scopeAllows(scope, { classId: curriculum.classId, subjectId: curriculum.subjectId }) && curriculum.createdById !== context.user.id) {
      throw AppError.notFound('Curriculum');
    }
    if (term.sessionId !== curriculum.sessionId) {
      throw AppError.validation(`${curriculum.name} belongs to ${curriculum.sessionName}; pick a term in that session.`);
    }

    const existing = await this.schemes.findByCurriculumAndTerm(schoolId, curriculum.id, term.id);
    if (existing) {
      throw AppError.conflict('A scheme of work for this curriculum and term already exists. Open it instead of generating another.');
    }

    const topics = await this.curricula.topicsWithObjectives(schoolId, curriculum.id);
    if (topics.length === 0) {
      throw AppError.validation('Add at least one topic to the curriculum before generating a scheme from it.');
    }

    const weeks = layOutWeeks(term, topics);

    const saved = await AppDataSource.transaction((manager) =>
      this.schemes.createWithWeeks(
        {
          schoolId,
          curriculumId: curriculum.id,
          subjectId: curriculum.subjectId,
          classId: curriculum.classId,
          termId: term.id,
          status: 'DRAFT',
          createdByUserId: context.user.id,
          createdByName: context.user.displayName,
          approvedByName: null,
          approvedAt: null,
        },
        weeks,
        manager,
      ),
    );

    await this.audit.record(context, {
      action: 'scheme.generated',
      entityType: 'SchemeOfWork',
      entityId: saved.id,
      entityLabel: `${curriculum.subjectName} · ${curriculum.className} · ${term.name}`,
      after: { curriculumId: curriculum.id, termId: term.id, weeks: weeks.length },
    });

    const dto = await this.schemes.findOneDTO(schoolId, saved.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * Weeks are saved whole, matched by id; status moves one step forward.
   * Anyone who may see a draft may edit and submit it; approving takes
   * `scheme.approve`. An approved scheme is frozen.
   */
  async updateScheme(
    context: RequestContext,
    id: string,
    input: UpdateSchemeInput,
    expectedVersion: number | undefined,
  ): Promise<SchemeOfWorkDTO> {
    const { schoolId } = context;
    const existing = await this.resolveVisible(context, id);

    if (existing.status === 'APPROVED') {
      throw AppError.conflict('This scheme has been approved and can no longer be changed.');
    }
    if (input.status === 'SUBMITTED' && existing.status !== 'DRAFT') {
      throw AppError.conflict('Only a draft can be submitted.');
    }
    if (input.status === 'APPROVED') {
      if (!context.can('scheme.approve')) throw AppError.forbidden('Approving a scheme takes the scheme.approve permission.');
      if (existing.status !== 'SUBMITTED') throw AppError.conflict('A scheme must be submitted before it is approved.');
    }

    // Weeks are saved whole, so a field left out of one is cleared, not kept.
    const known = new Set(existing.weeks.map((week) => week.id));
    const weeks = (input.weeks ?? [])
      .filter((week) => known.has(week.id))
      .map((week) => ({ ...week, activities: week.activities ?? null, resources: week.resources ?? null }));

    const patch: Record<string, unknown> = {};
    if (input.status) patch.status = input.status;
    if (input.status === 'APPROVED') {
      patch.approvedByName = context.user.displayName;
      patch.approvedAt = new Date();
    }

    const applied = await AppDataSource.transaction((manager) =>
      this.schemes.saveWeeksIfVersionMatches(schoolId, id, expectedVersion ?? existing.version, weeks, patch, manager),
    );
    if (!applied) throw AppError.versionConflict();

    if (input.status) {
      await this.audit.record(context, {
        action: input.status === 'APPROVED' ? 'scheme.approved' : 'scheme.submitted',
        entityType: 'SchemeOfWork',
        entityId: id,
        entityLabel: `${existing.subjectName} · ${existing.className} · ${existing.termName}`,
        before: { status: existing.status },
        after: { status: input.status },
      });
    }

    const dto = await this.schemes.findOneDTO(schoolId, id);
    if (!dto) throw AppError.notFound('Scheme of work');
    return dto;
  }

  /* -- Lesson notes ---------------------------------------------------------- */

  async fetchLessonNotes(context: RequestContext, query: FetchLessonNotesQuery): Promise<Paginated<LessonNoteDTO>> {
    return this.schemes.fetchNotes(context.schoolId, {
      ...query,
      teacherId: this.notesVisibleTeacher(context),
    });
  }

  async fetchLessonNote(context: RequestContext, id: string): Promise<LessonNoteDTO> {
    return this.resolveVisibleNote(context, id);
  }

  /** Class, subject, term, topic and objectives are copied from the scheme week. */
  async createLessonNote(context: RequestContext, input: CreateLessonNoteInput): Promise<LessonNoteDTO> {
    const { schoolId } = context;
    const staffId = context.membership.staffId;
    if (!staffId) {
      throw AppError.validation('Lesson notes are written by teaching staff; this account has no staff record.');
    }

    const scheme = await this.resolveVisible(context, input.schemeId);
    const week = scheme.weeks.find((entry) => entry.id === input.schemeWeekId);
    if (!week) throw AppError.notFound('Scheme week');
    if (week.isBreak) throw AppError.validation(`Week ${week.weekNumber} is a break; there is no lesson to note.`);

    const created = await this.schemes.createNote({
      schoolId,
      teacherId: staffId,
      teacherName: context.user.displayName,
      schemeId: scheme.id,
      schemeWeekId: week.id,
      classId: scheme.classId,
      subjectId: scheme.subjectId,
      termId: scheme.termId,
      weekNumber: week.weekNumber,
      date: input.date,
      topic: week.topicTitle || `Week ${week.weekNumber}`,
      objectiveIds: week.objectiveIds,
      objectiveStatements: week.objectiveStatements,
      content: input.content,
      resources: week.resources,
      assignment: input.assignment ?? null,
      challenges: input.challenges ?? null,
      studentDifficulties: input.studentDifficulties ?? null,
      status: input.status ?? 'DRAFT',
      reviewerName: null,
      reviewedAt: null,
      reviewComment: null,
    });

    const dto = await this.schemes.findNoteDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * The author edits while a note is a draft or has been returned, and
   * submits it; a reviewer approves or returns a submitted note with a
   * comment. Nothing else moves.
   */
  async updateLessonNote(
    context: RequestContext,
    id: string,
    input: UpdateLessonNoteInput,
    expectedVersion: number | undefined,
  ): Promise<LessonNoteDTO> {
    const { schoolId } = context;
    const existing = await this.resolveVisibleNote(context, id);
    const isAuthor = existing.teacherId === context.membership.staffId;
    const mayEdit = isAuthor || context.can('academics.manage');
    const editable = existing.status === 'DRAFT' || existing.status === 'RETURNED';

    const { status, reviewComment, ...content } = input;
    const contentPatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(content)) {
      if (value !== undefined && key !== 'schemeId' && key !== 'schemeWeekId') contentPatch[key] = value;
    }

    const patch: Record<string, unknown> = {};
    if (Object.keys(contentPatch).length > 0) {
      if (!mayEdit) throw AppError.forbidden('Only the teacher who wrote this note may change it.');
      if (!editable) throw AppError.conflict('A submitted note cannot be changed until it is returned.');
      Object.assign(patch, contentPatch);
    }

    if (status && status !== existing.status) {
      if (status === 'SUBMITTED' || status === 'DRAFT') {
        if (!mayEdit) throw AppError.forbidden('Only the teacher who wrote this note may submit it.');
        if (!editable) throw AppError.conflict('This note has already been submitted.');
      } else {
        if (!context.can('lessonnote.approve')) throw AppError.forbidden('Reviewing a note takes the lessonnote.approve permission.');
        if (existing.status !== 'SUBMITTED') throw AppError.conflict('Only a submitted note can be approved or returned.');
        patch.reviewerName = context.user.displayName;
        patch.reviewedAt = new Date();
        patch.reviewComment = reviewComment ?? null;
      }
      patch.status = status;
    } else if (reviewComment !== undefined && context.can('lessonnote.approve')) {
      patch.reviewComment = reviewComment;
    }

    if (Object.keys(patch).length > 0) {
      const applied = await this.schemes.updateNoteIfVersionMatches(schoolId, id, expectedVersion, patch);
      if (!applied) throw AppError.versionConflict();
    }

    const dto = await this.schemes.findNoteDTO(schoolId, id);
    if (!dto) throw AppError.notFound('Lesson note');
    return dto;
  }

  async removeLessonNote(context: RequestContext, id: string): Promise<void> {
    const existing = await this.resolveVisibleNote(context, id);
    if (existing.teacherId !== context.membership.staffId && !context.can('academics.manage')) {
      throw AppError.forbidden('Only the teacher who wrote this note may delete it.');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
      throw AppError.conflict('A submitted or approved note is part of the record and cannot be deleted.');
    }
    await this.schemes.removeNotes(context.schoolId, [id], null);
  }

  /** Deletes what the caller is allowed to delete and reports the count; the rest stay. */
  async bulkDeleteLessonNotes(context: RequestContext, ids: string[]): Promise<{ deleted: number }> {
    const unrestricted = context.can('academics.manage');
    if (!unrestricted && !context.membership.staffId) return { deleted: 0 };
    const deleted = await this.schemes.removeNotes(
      context.schoolId,
      ids,
      unrestricted ? null : context.membership.staffId,
    );
    return { deleted };
  }

  /* -- Internals ------------------------------------------------------------- */

  private async resolveVisible(context: RequestContext, id: string): Promise<SchemeOfWorkDTO> {
    const scheme = await this.schemes.findOneDTO(context.schoolId, id);
    if (!scheme) throw AppError.notFound('Scheme of work');
    const scope = await this.scope.forContext(context);
    const teaches = scopeAllows(scope, { classId: scheme.classId, subjectId: scheme.subjectId });
    if (!teaches && scheme.createdById !== context.user.id) throw AppError.notFound('Scheme of work');
    return scheme;
  }

  private async resolveVisibleNote(context: RequestContext, id: string): Promise<LessonNoteDTO> {
    const note = await this.schemes.findNoteDTO(context.schoolId, id);
    if (!note) throw AppError.notFound('Lesson note');
    const onlyOwn = this.notesVisibleTeacher(context);
    if (onlyOwn && note.teacherId !== onlyOwn) throw AppError.notFound('Lesson note');
    return note;
  }

  /** Reviewers and administrators see every note; a teacher sees their own. */
  private notesVisibleTeacher(context: RequestContext): string | null {
    if (context.can('lessonnote.approve') || context.can('academics.manage')) return null;
    return context.membership.staffId ?? '00000000-0000-0000-0000-000000000000';
  }
}

/* -- Laying a curriculum across a term ------------------------------------ */

type WeekDraft = Omit<SchemeWeekDTO, 'id'>;

export function layOutWeeks(term: TermDTO, topics: CurriculumTopicDTO[]): WeekDraft[] {
  const totalWeeks = weeksInTerm(term);
  const allocation = allocateWeeks(
    topics.map((topic) => Math.max(1, topic.suggestedWeeks)),
    totalWeeks,
  );

  const weeks: WeekDraft[] = [];
  let weekNumber = 1;
  topics.forEach((topic, index) => {
    const span = allocation[index];
    const chunks = splitEvenly(topic.objectives, span);
    for (let i = 0; i < span; i += 1) {
      const objectives = chunks[i];
      weeks.push({
        weekNumber,
        ...weekDates(term, weekNumber),
        topicId: topic.id,
        topicTitle: span > 1 ? `${topic.title} (${i + 1}/${span})` : topic.title,
        objectiveIds: objectives.map((objective) => objective.id),
        objectiveStatements: objectives.map((objective) => objective.statement),
        activities: null,
        resources: null,
        isBreak: false,
      });
      weekNumber += 1;
    }
  });

  while (weekNumber <= totalWeeks) {
    weeks.push({
      weekNumber,
      ...weekDates(term, weekNumber),
      topicId: null,
      topicTitle: weekNumber === totalWeeks ? 'Revision and examinations' : 'Revision',
      objectiveIds: [],
      objectiveStatements: [],
      activities: null,
      resources: null,
      isBreak: false,
    });
    weekNumber += 1;
  }

  return weeks;
}

function weeksInTerm(term: TermDTO): number {
  if (term.teachingWeeks > 0) return Math.min(MAX_WEEKS, term.teachingWeeks);
  const days = (Date.parse(term.endDate) - Date.parse(term.startDate)) / 86_400_000 + 1;
  return Math.max(1, Math.min(MAX_WEEKS, Math.ceil(days / 7)));
}

function weekDates(term: TermDTO, weekNumber: number): { startDate: string; endDate: string } {
  const start = new Date(`${term.startDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + (weekNumber - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const termEnd = new Date(`${term.endDate}T00:00:00Z`);
  const clampedEnd = end > termEnd ? termEnd : end;
  return { startDate: iso(start), endDate: iso(clampedEnd < start ? start : clampedEnd) };
}

/**
 * How many weeks each topic gets. Everything fits when the asks add up to
 * no more than the term; otherwise each is scaled down in proportion, never
 * below one week, and whatever rounding leaves over goes to the earliest
 * topics that asked for more than they got.
 */
export function allocateWeeks(asks: number[], totalWeeks: number): number[] {
  const demand = asks.reduce((sum, ask) => sum + ask, 0);
  if (demand <= totalWeeks) return [...asks];

  const scaled = asks.map((ask) => Math.max(1, Math.floor((ask * totalWeeks) / demand)));
  let used = scaled.reduce((sum, weeks) => sum + weeks, 0);

  // Too many topics for the term at one week each: the last ones lose their week entirely.
  for (let i = scaled.length - 1; used > totalWeeks && i >= 0; i -= 1) {
    if (scaled[i] > 0) {
      used -= scaled[i];
      scaled[i] = 0;
    }
  }
  for (let i = 0; used < totalWeeks && i < scaled.length; i += 1) {
    if (scaled[i] > 0 && scaled[i] < asks[i]) {
      scaled[i] += 1;
      used += 1;
    }
  }
  return scaled;
}

function splitEvenly<T>(items: T[], parts: number): T[][] {
  const chunks: T[][] = Array.from({ length: parts }, () => []);
  items.forEach((item, index) => {
    chunks[Math.min(parts - 1, Math.floor((index * parts) / Math.max(1, items.length)))].push(item);
  });
  return chunks;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
