import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { SubjectRepository } from '../../academics/repositories/subject.repository';
import { SessionRepository } from '../../academics/repositories/session.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService, scopeAllows } from '../../academics/services/academicScope.service';
import { CurriculumRepository } from '../repositories/curriculum.repository';
import type {
  CurriculumCoverageDTO,
  CurriculumDTO,
  CurriculumTopicDTO,
  LearningObjectiveDTO,
} from '../dto/curriculum.dto';
import type {
  CreateCurriculumInput,
  CreateObjectiveInput,
  CreateTopicInput,
  FetchCoverageQuery,
  FetchCurriculaQuery,
  MarkCoverageInput,
  UpdateCurriculumInput,
  UpdateObjectiveInput,
  UpdateTopicInput,
} from '../validators/curriculum.schema';

/**
 * The curriculum tree (spec section 13): what one class is meant to be taught
 * in one subject this session, down to the individual performance objective,
 * and which of those objectives have actually been taught and tested.
 *
 * Visibility follows teaching. Anyone with oversight sees every plan; a
 * teacher sees the plans for the (class, subject) pairs they are assigned,
 * plus anything they wrote themselves. That narrowing is applied on every read
 * and every write here, so a plan a teacher cannot see is one they cannot
 * touch either — "not found" rather than "forbidden", because which classes
 * have a curriculum is not a colleague's business.
 *
 * Coverage is the one rule with teeth: nothing is assessed before it is
 * taught. Marking assessed marks taught with it, clearing taught clears
 * assessed with it, and the table's own check constraint holds the line
 * against anything else.
 */
export class CurriculumService {
  static Instance = new CurriculumService();

  private constructor(
    private readonly curricula = CurriculumRepository.Instance,
    private readonly classes = ClassRepository.Instance,
    private readonly subjects = SubjectRepository.Instance,
    private readonly sessions = SessionRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /* -- Curricula ------------------------------------------------------------- */

  /**
   * Narrowed to the current session unless the caller asks for another one, or
   * for `ALL`: a syllabus is rewritten year on year, and last year's plan must
   * not keep answering for this one.
   */
  async fetchCurricula(context: RequestContext, query: FetchCurriculaQuery): Promise<CurriculumDTO[]> {
    const [scope, sessionId] = await Promise.all([
      this.scope.forContext(context),
      this.resolveSessionFilter(context.schoolId, query.sessionId),
    ]);

    // A school with no current session has no current plans, not every plan.
    if (sessionId === undefined && query.sessionId !== 'ALL') return [];

    return this.curricula.fetchAll(context.schoolId, {
      subjectId: query.subjectId,
      levelId: query.levelId,
      classId: query.classId,
      createdById: query.createdById,
      sessionId,
      visibility: { pairs: scope.pairs, authorUserId: context.user.id },
    });
  }

  async createCurriculum(context: RequestContext, input: CreateCurriculumInput): Promise<CurriculumDTO> {
    const { schoolId } = context;

    const [schoolClass, subject, sessions, scope] = await Promise.all([
      this.classes.findOneDTO(schoolId, input.classId),
      this.subjects.findOneDTO(schoolId, input.subjectId),
      this.sessions.fetchForSchool(schoolId),
      this.scope.forContext(context),
    ]);
    if (!schoolClass) throw AppError.notFound('Class');
    if (!subject) throw AppError.notFound('Subject');

    const session = sessions.find((entry) => entry.isCurrent);
    if (!session) {
      throw AppError.validation(
        'The school has no current session. Make one current under Academic setup before writing a curriculum.',
      );
    }

    if (!scopeAllows(scope, { classId: schoolClass.id, subjectId: subject.id })) {
      throw AppError.validation(`You are not assigned ${subject.name} in ${schoolClass.name}.`);
    }

    await this.refuseDuplicate(schoolId, {
      sessionId: session.id,
      classId: schoolClass.id,
      subjectId: subject.id,
    });

    const created = await this.curricula.create({
      schoolId,
      sessionId: session.id,
      classId: schoolClass.id,
      levelId: schoolClass.levelId,
      subjectId: subject.id,
      name: input.name?.trim() || `${subject.name} — ${schoolClass.name}`,
      description: input.description ?? null,
      isActive: true,
      createdByUserId: context.user.id,
      createdByName: context.user.displayName,
      createdByRole:
        context.membership.roles[0] ?? context.membership.customRoleNames[0] ?? 'Member',
    });

    await this.audit.record(context, {
      action: 'curriculum.created',
      entityType: 'Curriculum',
      entityId: created.id,
      entityLabel: created.name,
      after: { classId: created.classId, subjectId: created.subjectId, sessionId: created.sessionId },
    });

    const dto = await this.curricula.findOneDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateCurriculum(
    context: RequestContext,
    id: string,
    patch: UpdateCurriculumInput,
  ): Promise<CurriculumDTO> {
    const { schoolId } = context;
    const existing = await this.resolveVisible(context, id);

    const columns: Record<string, unknown> = {};
    if (patch.name !== undefined) columns.name = patch.name.trim() || existing.name;
    if (patch.description !== undefined) columns.description = patch.description;
    if (patch.isActive !== undefined) columns.isActive = patch.isActive;

    const classId = patch.classId ?? existing.classId;
    const subjectId = patch.subjectId ?? existing.subjectId;
    if (classId !== existing.classId || subjectId !== existing.subjectId) {
      const [schoolClass, subject, scope] = await Promise.all([
        this.classes.findOneDTO(schoolId, classId),
        this.subjects.findOneDTO(schoolId, subjectId),
        this.scope.forContext(context),
      ]);
      if (!schoolClass) throw AppError.notFound('Class');
      if (!subject) throw AppError.notFound('Subject');
      if (!scopeAllows(scope, { classId, subjectId })) {
        throw AppError.validation(`You are not assigned ${subject.name} in ${schoolClass.name}.`);
      }
      await this.refuseDuplicate(schoolId, { sessionId: existing.sessionId, classId, subjectId }, id);
      columns.classId = classId;
      columns.levelId = schoolClass.levelId;
      columns.subjectId = subjectId;
    }

    if (Object.keys(columns).length > 0) {
      await this.curricula.update(schoolId, id, columns);
      await this.audit.record(context, {
        action: 'curriculum.updated',
        entityType: 'Curriculum',
        entityId: id,
        entityLabel: existing.name,
        before: { classId: existing.classId, subjectId: existing.subjectId, isActive: existing.isActive },
        after: columns,
      });
    }

    const dto = await this.curricula.findOneDTO(schoolId, id);
    if (!dto) throw AppError.notFound('Curriculum');
    return dto;
  }

  /**
   * The author may delete their own plan; otherwise it takes `academics.manage`.
   * Anyone else who can see it may still edit it — a head of department
   * refining a colleague's plan is normal, deleting it is not.
   */
  async removeCurriculum(context: RequestContext, id: string): Promise<void> {
    const existing = await this.resolveVisible(context, id);

    if (!context.can('academics.manage') && existing.createdById !== context.user.id) {
      throw AppError.forbidden('Only the person who wrote this curriculum, or an administrator, may delete it.');
    }

    await this.curricula.remove(context.schoolId, id);

    await this.audit.record(context, {
      action: 'curriculum.deleted',
      entityType: 'Curriculum',
      entityId: id,
      entityLabel: existing.name,
      before: {
        classId: existing.classId,
        subjectId: existing.subjectId,
        topics: existing.topicCount,
        objectives: existing.objectiveCount,
      },
      severity: 'WARNING',
    });
  }

  /* -- Topics ---------------------------------------------------------------- */

  async fetchTopics(context: RequestContext, curriculumId: string): Promise<CurriculumTopicDTO[]> {
    await this.resolveVisible(context, curriculumId);
    return this.curricula.topicsWithObjectives(context.schoolId, curriculumId);
  }

  async createTopic(
    context: RequestContext,
    curriculumId: string,
    input: CreateTopicInput,
  ): Promise<CurriculumTopicDTO> {
    const { schoolId } = context;
    await this.resolveVisible(context, curriculumId);

    const sequence = input.sequence ?? (await this.curricula.nextTopicSequence(schoolId, curriculumId));
    const created = await this.curricula.createTopic({
      schoolId,
      curriculumId,
      title: input.title,
      description: input.description ?? null,
      sequence,
      suggestedWeeks: input.suggestedWeeks,
    });

    const dto = await this.curricula.findTopicDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateTopic(
    context: RequestContext,
    curriculumId: string,
    topicId: string,
    patch: UpdateTopicInput,
  ): Promise<CurriculumTopicDTO> {
    const { schoolId } = context;
    await this.resolveVisible(context, curriculumId);
    await this.resolveTopic(schoolId, curriculumId, topicId);

    const columns: Record<string, unknown> = {};
    if (patch.title !== undefined) columns.title = patch.title;
    if (patch.description !== undefined) columns.description = patch.description;
    if (patch.sequence !== undefined) columns.sequence = patch.sequence;
    if (patch.suggestedWeeks !== undefined) columns.suggestedWeeks = patch.suggestedWeeks;
    if (Object.keys(columns).length > 0) await this.curricula.updateTopic(schoolId, topicId, columns);

    const dto = await this.curricula.findTopicDTO(schoolId, topicId);
    if (!dto) throw AppError.notFound('Topic');
    return dto;
  }

  async removeTopic(context: RequestContext, curriculumId: string, topicId: string): Promise<void> {
    await this.resolveVisible(context, curriculumId);
    await this.resolveTopic(context.schoolId, curriculumId, topicId);
    await this.curricula.removeTopic(context.schoolId, topicId);
  }

  /* -- Objectives ------------------------------------------------------------ */

  async createObjective(
    context: RequestContext,
    curriculumId: string,
    topicId: string,
    input: CreateObjectiveInput,
  ): Promise<LearningObjectiveDTO> {
    const { schoolId } = context;
    await this.resolveVisible(context, curriculumId);
    await this.resolveTopic(schoolId, curriculumId, topicId);

    const sequence = input.sequence ?? (await this.curricula.nextObjectiveSequence(schoolId, topicId));
    const created = await this.curricula.createObjective({
      schoolId,
      topicId,
      statement: input.statement,
      sequence,
      bloomLevel: input.bloomLevel ?? null,
      taughtAt: null,
      assessedAt: null,
    });

    const dto = await this.curricula.findObjectiveDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateObjective(
    context: RequestContext,
    curriculumId: string,
    topicId: string,
    objectiveId: string,
    patch: UpdateObjectiveInput,
  ): Promise<LearningObjectiveDTO> {
    const { schoolId } = context;
    await this.resolveVisible(context, curriculumId);
    await this.resolveTopic(schoolId, curriculumId, topicId);
    if (!(await this.curricula.findObjective(schoolId, topicId, objectiveId))) {
      throw AppError.notFound('Objective');
    }

    const columns: Record<string, unknown> = {};
    if (patch.statement !== undefined) columns.statement = patch.statement;
    if (patch.bloomLevel !== undefined) columns.bloomLevel = patch.bloomLevel;
    if (patch.sequence !== undefined) columns.sequence = patch.sequence;
    if (Object.keys(columns).length > 0) {
      await this.curricula.updateObjective(schoolId, objectiveId, columns);
    }

    const dto = await this.curricula.findObjectiveDTO(schoolId, objectiveId);
    if (!dto) throw AppError.notFound('Objective');
    return dto;
  }

  async removeObjective(
    context: RequestContext,
    curriculumId: string,
    topicId: string,
    objectiveId: string,
  ): Promise<void> {
    const { schoolId } = context;
    await this.resolveVisible(context, curriculumId);
    await this.resolveTopic(schoolId, curriculumId, topicId);
    if (!(await this.curricula.findObjective(schoolId, topicId, objectiveId))) {
      throw AppError.notFound('Objective');
    }
    await this.curricula.removeObjective(schoolId, objectiveId);
  }

  /* -- Coverage -------------------------------------------------------------- */

  /**
   * The report that turns a syllabus gap into a weekly fix: of everything the
   * plan says this class should learn, what has been taught, what has been
   * tested, and what has been quietly skipped.
   */
  async fetchCoverage(context: RequestContext, query: FetchCoverageQuery): Promise<CurriculumCoverageDTO> {
    const curriculum = await this.resolveVisible(context, query.curriculumId);
    const [topics, terms] = await Promise.all([
      this.curricula.topicsWithObjectives(context.schoolId, curriculum.id),
      this.terms.fetchForSchool(context.schoolId),
    ]);
    const current = terms.find((term) => term.isCurrent);

    const cells = topics.flatMap((topic) =>
      topic.objectives.map((objective) => ({
        topicId: topic.id,
        topicTitle: topic.title,
        objectiveId: objective.id,
        objectiveCode: objective.code,
        statement: objective.statement,
        taught: objective.taught,
        assessed: objective.assessed,
      })),
    );

    const total = cells.length;
    const taughtCount = cells.filter((cell) => cell.taught).length;
    const assessedCount = cells.filter((cell) => cell.assessed).length;
    const rate = (count: number) => (total === 0 ? 0 : Math.round((1000 * count) / total) / 10);

    return {
      curriculumId: curriculum.id,
      subjectName: curriculum.subjectName,
      className: curriculum.className,
      termName: current ? `${current.name}, ${current.sessionName}` : curriculum.sessionName,
      totalObjectives: total,
      taughtCount,
      assessedCount,
      taughtNotAssessed: taughtCount - assessedCount,
      neverTaught: total - taughtCount,
      coverageRate: rate(taughtCount),
      assessmentRate: rate(assessedCount),
      cells,
    };
  }

  async markCoverage(
    context: RequestContext,
    curriculumId: string,
    input: MarkCoverageInput,
  ): Promise<{ updated: number }> {
    await this.resolveVisible(context, curriculumId);
    const updated = await this.curricula.markCoverage(
      context.schoolId,
      curriculumId,
      input.objectiveIds,
      { taught: input.taught, assessed: input.assessed },
      todayIso(),
    );
    return { updated };
  }

  /* -- Internals ------------------------------------------------------------- */

  /**
   * The curriculum, if this caller may see it at all. A teacher sees the plans
   * for the pairs they teach and the ones they wrote; anything else is "not
   * found" rather than "forbidden".
   */
  private async resolveVisible(context: RequestContext, id: string): Promise<CurriculumDTO> {
    const curriculum = await this.curricula.findOneDTO(context.schoolId, id);
    if (!curriculum) throw AppError.notFound('Curriculum');

    const scope = await this.scope.forContext(context);
    const teaches = scopeAllows(scope, {
      classId: curriculum.classId,
      subjectId: curriculum.subjectId,
    });
    if (!teaches && curriculum.createdById !== context.user.id) {
      throw AppError.notFound('Curriculum');
    }
    return curriculum;
  }

  private async resolveTopic(schoolId: string, curriculumId: string, topicId: string) {
    const topic = await this.curricula.findTopic(schoolId, curriculumId, topicId);
    if (!topic) throw AppError.notFound('Topic');
    return topic;
  }

  private async refuseDuplicate(
    schoolId: string,
    trio: { sessionId: string; classId: string; subjectId: string },
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.curricula.findByTrio(schoolId, trio);
    if (clash && clash.id !== exceptId) {
      throw AppError.conflict(
        'That class already has a curriculum for this subject this session. Open it instead of writing a second one.',
      );
    }
  }

  /**
   * The session id to filter on: the named one, `undefined` for `ALL`, or the
   * current one. Undefined *without* `ALL` means the school has no current
   * session, which the caller turns into an empty list.
   */
  private async resolveSessionFilter(
    schoolId: string,
    requested: string | undefined,
  ): Promise<string | undefined> {
    if (requested === 'ALL') return undefined;
    if (requested) return requested;
    const sessions = await this.sessions.fetchForSchool(schoolId);
    return sessions.find((session) => session.isCurrent)?.id;
  }
}

/** Matching how the rest of the server reads "today" (`studentRelations.service`). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
