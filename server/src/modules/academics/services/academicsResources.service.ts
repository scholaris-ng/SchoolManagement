import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { SubjectRepository } from '../repositories/subject.repository';
import {
  HouseRepository,
  PeriodRepository,
  RoomRepository,
} from '../repositories/facility.repository';
import { AcademicScopeService, scopeAllows } from './academicScope.service';
import type {
  HouseDTO,
  RoomDTO,
  SubjectDTO,
  TimetablePeriodDTO,
} from '../dto/academics.dto';
import type {
  CreateHouseInput,
  CreatePeriodInput,
  CreateRoomInput,
  CreateSubjectInput,
  FetchSubjectsQuery,
  UpdateHouseInput,
  UpdatePeriodInput,
  UpdateRoomInput,
  UpdateSubjectInput,
} from '../validators/academics.schema';

/** What the school teaches with: subjects, rooms, houses and the daily grid. */
export class AcademicsResourcesService {
  static Instance = new AcademicsResourcesService();

  private constructor(
    private readonly subjects = SubjectRepository.Instance,
    private readonly rooms = RoomRepository.Instance,
    private readonly houses = HouseRepository.Instance,
    private readonly periods = PeriodRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  // ─── Subjects ──────────────────────────────────────────────────────────────

  async fetchSubjects(
    context: RequestContext,
    query: FetchSubjectsQuery,
  ): Promise<SubjectDTO[]> {
    // Asking for a class's subjects is asking for its level's; resolving it here
    // saves every caller from having to know that.
    const levelId =
      query.levelId ??
      (query.classId
        ? await this.subjects.levelIdForClass(context.schoolId, query.classId)
        : null);

    const scope = await this.scope.forContext(context);

    if (!query.classId) {
      return this.subjects.fetchForSchool(context.schoolId, {
        levelId,
        allowedIds: scope.subjectIds,
      });
    }

    // A class was named, so answer with the subjects actually paired with that
    // class — not "any subject at its level that this teacher happens to teach
    // somewhere else", which is what checking the two flat lists independently
    // would give.
    const candidates = await this.subjects.fetchForSchool(context.schoolId, {
      levelId,
      allowedIds: null,
    });
    return candidates.filter((subject) =>
      scopeAllows(scope, { classId: query.classId, subjectId: subject.id }),
    );
  }

  async createSubject(
    context: RequestContext,
    input: CreateSubjectInput,
  ): Promise<SubjectDTO> {
    const code = input.code.trim().toUpperCase();
    const clash = await this.subjects.findByCode(context.schoolId, code);
    if (clash) throw AppError.conflict('A subject with that code already exists.');

    const subject = await this.subjects.create({
      schoolId: context.schoolId,
      name: input.name,
      code,
      category: input.category?.trim() || null,
      isCore: input.isCore ?? true,
      isActive: true,
      schedule: input.schedule ?? [],
    });

    if (input.levelIds?.length) {
      await this.subjects.replaceLevels(context.schoolId, subject.id, input.levelIds);
    }

    await this.audit.record(context, {
      action: 'academics.subject_created',
      entityType: 'Subject',
      entityId: subject.id,
      entityLabel: subject.name,
      after: { name: subject.name, code: subject.code },
    });

    const dto = await this.subjects.findOneDTO(context.schoolId, subject.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateSubject(
    context: RequestContext,
    id: string,
    patch: UpdateSubjectInput,
  ): Promise<SubjectDTO> {
    const subject = await this.subjects.findByIdScoped(context.schoolId, id);
    if (!subject) throw AppError.notFound('Subject');

    const code = patch.code ? patch.code.trim().toUpperCase() : undefined;
    if (code && code !== subject.code) {
      const clash = await this.subjects.findByCode(context.schoolId, code);
      if (clash) throw AppError.conflict('A subject with that code already exists.');
    }

    const { levelIds, ...columns } = patch;
    await this.subjects.update(subject.id, { ...columns, ...(code ? { code } : {}) });

    if (levelIds !== undefined) {
      await this.subjects.replaceLevels(context.schoolId, subject.id, levelIds);
    }

    await this.audit.record(context, {
      action: 'academics.subject_updated',
      entityType: 'Subject',
      entityId: subject.id,
      entityLabel: patch.name ?? subject.name,
      before: { name: subject.name, code: subject.code },
      after: { name: patch.name ?? subject.name, code: code ?? subject.code },
    });

    const dto = await this.subjects.findOneDTO(context.schoolId, subject.id);
    if (!dto) throw AppError.notFound('Subject');
    return dto;
  }

  /**
   * Deactivates rather than deletes.
   *
   * A subject is referenced by past results and report cards, so removing the
   * row would rewrite history. Hiding it from pickers is what the school
   * actually means by "delete this subject".
   */
  async removeSubject(context: RequestContext, id: string): Promise<void> {
    const subject = await this.subjects.findByIdScoped(context.schoolId, id);
    if (!subject) throw AppError.notFound('Subject');

    await this.subjects.update(subject.id, { isActive: false });
    await this.subjects.softDeleteScoped(context.schoolId, subject.id);

    await this.audit.record(context, {
      action: 'academics.subject_deleted',
      entityType: 'Subject',
      entityId: subject.id,
      entityLabel: subject.name,
      before: { name: subject.name },
      severity: 'WARNING',
    });
  }

  // ─── Rooms ─────────────────────────────────────────────────────────────────

  async fetchRooms(context: RequestContext): Promise<RoomDTO[]> {
    return this.rooms.fetchForSchool(context.schoolId);
  }

  async createRoom(context: RequestContext, input: CreateRoomInput): Promise<RoomDTO> {
    const code = normaliseCode(input.code ?? input.name);
    const clash = await this.rooms.findByCode(context.schoolId, code);
    if (clash) throw AppError.conflict('A room with that code already exists.');

    const room = await this.rooms.create({
      schoolId: context.schoolId,
      name: input.name,
      code,
      capacity: input.capacity ?? 30,
      type: input.type ?? 'CLASSROOM',
    });

    await this.audit.record(context, {
      action: 'academics.room_created',
      entityType: 'Room',
      entityId: room.id,
      entityLabel: room.name,
    });

    const dto = await this.rooms.findOneDTO(context.schoolId, room.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateRoom(
    context: RequestContext,
    id: string,
    patch: UpdateRoomInput,
  ): Promise<RoomDTO> {
    const room = await this.rooms.findByIdScoped(context.schoolId, id);
    if (!room) throw AppError.notFound('Room');

    const code = patch.code ? normaliseCode(patch.code) : undefined;
    await this.rooms.update(room.id, { ...patch, ...(code ? { code } : {}) });

    await this.audit.record(context, {
      action: 'academics.room_updated',
      entityType: 'Room',
      entityId: room.id,
      entityLabel: patch.name ?? room.name,
    });

    const dto = await this.rooms.findOneDTO(context.schoolId, room.id);
    if (!dto) throw AppError.notFound('Room');
    return dto;
  }

  // ─── Houses ────────────────────────────────────────────────────────────────

  async fetchHouses(context: RequestContext): Promise<HouseDTO[]> {
    return this.houses.fetchForSchool(context.schoolId);
  }

  async createHouse(context: RequestContext, input: CreateHouseInput): Promise<HouseDTO> {
    const clash = await this.houses.findByName(context.schoolId, input.name);
    if (clash) throw AppError.conflict('A house with that name already exists.');

    const house = await this.houses.create({
      schoolId: context.schoolId,
      name: input.name,
      color: input.color ?? '#2563eb',
      motto: input.motto?.trim() || null,
      captainStudentId: null,
      points: 0,
    });

    await this.audit.record(context, {
      action: 'academics.house_created',
      entityType: 'House',
      entityId: house.id,
      entityLabel: house.name,
    });

    const dto = await this.houses.findOneDTO(context.schoolId, house.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateHouse(
    context: RequestContext,
    id: string,
    patch: UpdateHouseInput,
  ): Promise<HouseDTO> {
    const house = await this.houses.findByIdScoped(context.schoolId, id);
    if (!house) throw AppError.notFound('House');

    await this.houses.update(house.id, patch);

    await this.audit.record(context, {
      action: 'academics.house_updated',
      entityType: 'House',
      entityId: house.id,
      entityLabel: patch.name ?? house.name,
    });

    const dto = await this.houses.findOneDTO(context.schoolId, house.id);
    if (!dto) throw AppError.notFound('House');
    return dto;
  }

  // ─── Periods ───────────────────────────────────────────────────────────────

  async fetchPeriods(context: RequestContext): Promise<TimetablePeriodDTO[]> {
    return this.periods.fetchForSchool(context.schoolId);
  }

  async createPeriod(
    context: RequestContext,
    input: CreatePeriodInput,
  ): Promise<TimetablePeriodDTO> {
    const period = await this.periods.create({
      schoolId: context.schoolId,
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      sequence: input.sequence ?? (await this.periods.nextSequence(context.schoolId)),
      isBreak: input.isBreak ?? false,
    });

    await this.audit.record(context, {
      action: 'academics.period_created',
      entityType: 'TimetablePeriod',
      entityId: period.id,
      entityLabel: period.name,
    });

    const dto = await this.periods.findOneDTO(context.schoolId, period.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updatePeriod(
    context: RequestContext,
    id: string,
    patch: UpdatePeriodInput,
  ): Promise<TimetablePeriodDTO> {
    const period = await this.periods.findByIdScoped(context.schoolId, id);
    if (!period) throw AppError.notFound('Period');

    const startTime = patch.startTime ?? period.startTime;
    const endTime = patch.endTime ?? period.endTime;
    if (endTime <= startTime) {
      throw AppError.validation('A period cannot end before it starts.');
    }

    await this.periods.update(period.id, patch);

    await this.audit.record(context, {
      action: 'academics.period_updated',
      entityType: 'TimetablePeriod',
      entityId: period.id,
      entityLabel: patch.name ?? period.name,
    });

    const dto = await this.periods.findOneDTO(context.schoolId, period.id);
    if (!dto) throw AppError.notFound('Period');
    return dto;
  }

  /**
   * Removing a period is refused while lessons sit in it — the timetable module
   * owns those rows, so the check is deferred to it once it lands in phase 4.
   */
  async removePeriod(context: RequestContext, id: string): Promise<void> {
    const period = await this.periods.findByIdScoped(context.schoolId, id);
    if (!period) throw AppError.notFound('Period');

    await this.periods.softDeleteScoped(context.schoolId, period.id);

    await this.audit.record(context, {
      action: 'academics.period_deleted',
      entityType: 'TimetablePeriod',
      entityId: period.id,
      entityLabel: period.name,
      severity: 'WARNING',
    });
  }
}

function normaliseCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}
