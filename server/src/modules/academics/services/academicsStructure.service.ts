import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { teachingWeeksBetween } from '../../../shared/utils/weekdays';
import { AuditService } from '../../audit/services/audit.service';
import { SessionRepository } from '../repositories/session.repository';
import { TermRepository } from '../repositories/term.repository';
import { LevelRepository } from '../repositories/level.repository';
import { AcademicScopeService } from './academicScope.service';
import type {
  AcademicSessionDTO,
  SchoolLevelDTO,
  TermDTO,
} from '../dto/academics.dto';
import type {
  CreateLevelInput,
  CreateSessionInput,
  CreateTermInput,
  UpdateLevelInput,
  UpdateSessionInput,
  UpdateTermInput,
} from '../validators/academics.schema';

/**
 * The shape of the academic year: sessions, terms and the school's own level
 * ladder (spec section 9).
 *
 * Nothing here is hardcoded to one country's system. A Nigerian school defines
 * Creche through SSS 3 and a British-curriculum school defines Reception
 * through Year 11, and the same code serves both.
 */
export class AcademicsStructureService {
  static Instance = new AcademicsStructureService();

  private constructor(
    private readonly sessions = SessionRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly levels = LevelRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  // ─── Sessions ──────────────────────────────────────────────────────────────

  async fetchSessions(context: RequestContext): Promise<AcademicSessionDTO[]> {
    return this.sessions.fetchForSchool(context.schoolId);
  }

  async createSession(
    context: RequestContext,
    input: CreateSessionInput,
  ): Promise<AcademicSessionDTO> {
    const clash = await this.sessions.findByName(context.schoolId, input.name);
    if (clash) throw AppError.conflict('A session with that name already exists.');

    const session = await this.sessions.create({
      schoolId: context.schoolId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: false,
      status: 'PLANNED',
    });

    // Terms supplied alongside the session are created with it, in order.
    const seeds = input.terms ?? [];
    for (const [index, seed] of seeds.entries()) {
      const startDate = seed.startDate ?? session.startDate;
      const endDate = seed.endDate ?? session.endDate;
      await this.terms.create({
        schoolId: context.schoolId,
        sessionId: session.id,
        name: seed.name?.trim() || `Term ${index + 1}`,
        sequence: index + 1,
        startDate,
        endDate,
        // Read off the dates, never taken from the request.
        teachingWeeks: teachingWeeksBetween(startDate, endDate),
        isCurrent: false,
        status: 'PLANNED',
      });
    }

    await this.audit.record(context, {
      action: 'academics.session_created',
      entityType: 'AcademicSession',
      entityId: session.id,
      entityLabel: session.name,
      after: { name: session.name, terms: seeds.length },
    });

    const dto = await this.sessions.findOneDTO(context.schoolId, session.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateSession(
    context: RequestContext,
    id: string,
    patch: UpdateSessionInput,
  ): Promise<AcademicSessionDTO> {
    const session = await this.sessions.findByIdScoped(context.schoolId, id);
    if (!session) throw AppError.notFound('Academic session');

    const startDate = patch.startDate ?? session.startDate;
    const endDate = patch.endDate ?? session.endDate;
    if (endDate < startDate) {
      throw AppError.validation('A session cannot end before it starts.');
    }

    await this.sessions.update(session.id, patch);

    await this.audit.record(context, {
      action: 'academics.session_updated',
      entityType: 'AcademicSession',
      entityId: session.id,
      entityLabel: patch.name ?? session.name,
      before: { name: session.name, startDate: session.startDate, endDate: session.endDate },
      after: { name: patch.name ?? session.name, startDate, endDate },
    });

    const dto = await this.sessions.findOneDTO(context.schoolId, session.id);
    if (!dto) throw AppError.notFound('Academic session');
    return dto;
  }

  async removeSession(context: RequestContext, id: string): Promise<void> {
    const session = await this.sessions.findByIdScoped(context.schoolId, id);
    if (!session) throw AppError.notFound('Academic session');

    // Deleting the year the school is in the middle of would leave every
    // session-scoped screen with nothing to report on.
    if (session.isCurrent) {
      throw AppError.conflict(
        'This is the current session. Make another session current before deleting it.',
      );
    }

    await this.terms.deleteBySession(context.schoolId, session.id);
    await this.sessions.softDeleteScoped(context.schoolId, session.id);

    await this.audit.record(context, {
      action: 'academics.session_deleted',
      entityType: 'AcademicSession',
      entityId: session.id,
      entityLabel: session.name,
      before: { name: session.name },
      severity: 'WARNING',
    });
  }

  // ─── Terms ─────────────────────────────────────────────────────────────────

  async fetchTerms(context: RequestContext, sessionId?: string): Promise<TermDTO[]> {
    return this.terms.fetchForSchool(context.schoolId, sessionId);
  }

  async createTerm(context: RequestContext, input: CreateTermInput): Promise<TermDTO> {
    const session = await this.sessions.findByIdScoped(context.schoolId, input.sessionId);
    if (!session) throw AppError.notFound('Academic session');

    const term = await this.terms.create({
      schoolId: context.schoolId,
      sessionId: session.id,
      name: input.name,
      sequence: await this.terms.nextSequence(context.schoolId, session.id),
      startDate: input.startDate,
      endDate: input.endDate,
      teachingWeeks: teachingWeeksBetween(input.startDate, input.endDate),
      isCurrent: false,
      status: 'PLANNED',
    });

    await this.audit.record(context, {
      action: 'academics.term_created',
      entityType: 'Term',
      entityId: term.id,
      entityLabel: `${session.name} — ${term.name}`,
      after: { name: term.name, sequence: term.sequence },
    });

    const dto = await this.terms.findOneDTO(context.schoolId, term.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateTerm(
    context: RequestContext,
    id: string,
    patch: UpdateTermInput,
  ): Promise<TermDTO> {
    const term = await this.terms.findByIdScoped(context.schoolId, id);
    if (!term) throw AppError.notFound('Term');

    const startDate = patch.startDate ?? term.startDate;
    const endDate = patch.endDate ?? term.endDate;
    if (endDate < startDate) {
      throw AppError.validation('A term cannot end before it starts.');
    }

    await this.terms.update(term.id, {
      ...patch,
      // Recomputed rather than accepted, so moving a term's dates can never
      // leave a stale week count behind for a scheme of work to plan against.
      teachingWeeks: teachingWeeksBetween(startDate, endDate),
    });

    await this.audit.record(context, {
      action: 'academics.term_updated',
      entityType: 'Term',
      entityId: term.id,
      entityLabel: patch.name ?? term.name,
      before: { startDate: term.startDate, endDate: term.endDate },
      after: { startDate, endDate },
    });

    const dto = await this.terms.findOneDTO(context.schoolId, term.id);
    if (!dto) throw AppError.notFound('Term');
    return dto;
  }

  /**
   * Moves the school into a term — the single switch an administrator throws.
   *
   * The session follows its term: making a first-term-2026 term current moves
   * the whole school into that session, which is what everything scoped by
   * session then reports on.
   */
  async setCurrentTerm(context: RequestContext, id: string): Promise<TermDTO> {
    const term = await this.terms.findByIdScoped(context.schoolId, id);
    if (!term) throw AppError.notFound('Term');

    await this.terms.setCurrent(context.schoolId, term.id);
    await this.sessions.setCurrent(context.schoolId, term.sessionId);

    await this.audit.record(context, {
      action: 'academics.current_term_changed',
      entityType: 'Term',
      entityId: term.id,
      entityLabel: term.name,
      after: { termId: term.id, sessionId: term.sessionId },
      severity: 'WARNING',
    });

    const dto = await this.terms.findOneDTO(context.schoolId, term.id);
    if (!dto) throw AppError.notFound('Term');
    return dto;
  }

  // ─── Levels ────────────────────────────────────────────────────────────────

  /**
   * Levels follow the classes the caller can see, so a junior-school teacher is
   * never offered a level whose filter would only ever come back empty.
   */
  async fetchLevels(context: RequestContext): Promise<SchoolLevelDTO[]> {
    const scope = await this.scope.forContext(context);
    return this.levels.fetchForSchool(context.schoolId, scope.classIds);
  }

  async createLevel(context: RequestContext, input: CreateLevelInput): Promise<SchoolLevelDTO> {
    const code = normaliseCode(input.code ?? input.name);
    const clash = await this.levels.findByCode(context.schoolId, code);
    if (clash) throw AppError.conflict('A level with that code already exists.');

    const level = await this.levels.create({
      schoolId: context.schoolId,
      name: input.name,
      code,
      sequence: input.sequence ?? (await this.levels.nextSequence(context.schoolId)),
      gradingSchemeId: input.gradingSchemeId ?? null,
    });

    await this.audit.record(context, {
      action: 'academics.level_created',
      entityType: 'SchoolLevel',
      entityId: level.id,
      entityLabel: level.name,
      after: { name: level.name, code: level.code },
    });

    const dto = await this.levels.findOneDTO(context.schoolId, level.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateLevel(
    context: RequestContext,
    id: string,
    patch: UpdateLevelInput,
  ): Promise<SchoolLevelDTO> {
    const level = await this.levels.findByIdScoped(context.schoolId, id);
    if (!level) throw AppError.notFound('Level');

    const code = patch.code ? normaliseCode(patch.code) : undefined;
    if (code && code !== level.code) {
      const clash = await this.levels.findByCode(context.schoolId, code);
      if (clash) throw AppError.conflict('A level with that code already exists.');
    }

    await this.levels.update(level.id, { ...patch, ...(code ? { code } : {}) });

    await this.audit.record(context, {
      action: 'academics.level_updated',
      entityType: 'SchoolLevel',
      entityId: level.id,
      entityLabel: patch.name ?? level.name,
      before: { name: level.name, code: level.code, sequence: level.sequence },
      after: { name: patch.name ?? level.name, code: code ?? level.code },
    });

    const dto = await this.levels.findOneDTO(context.schoolId, level.id);
    if (!dto) throw AppError.notFound('Level');
    return dto;
  }

  async removeLevel(context: RequestContext, id: string): Promise<void> {
    const level = await this.levels.findByIdScoped(context.schoolId, id);
    if (!level) throw AppError.notFound('Level');

    // Classes reference their level, so removing one out from under them would
    // orphan every pupil in them.
    const classCount = await this.levels.countClasses(context.schoolId, level.id);
    if (classCount > 0) {
      throw AppError.conflict(
        `This level still has ${classCount} class${classCount === 1 ? '' : 'es'}. Move or delete them first.`,
      );
    }

    await this.levels.softDeleteScoped(context.schoolId, level.id);

    await this.audit.record(context, {
      action: 'academics.level_deleted',
      entityType: 'SchoolLevel',
      entityId: level.id,
      entityLabel: level.name,
      before: { name: level.name },
      severity: 'WARNING',
    });
  }
}

function normaliseCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}
