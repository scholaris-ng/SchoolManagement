import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { ClassRepository } from '../repositories/class.repository';
import { LevelRepository } from '../repositories/level.repository';
import { AcademicScopeService } from './academicScope.service';
import type { SchoolClassDTO } from '../dto/academics.dto';
import type {
  CreateClassInput,
  FetchClassesQuery,
  UpdateClassInput,
} from '../validators/academics.schema';

export class AcademicsClassService {
  static Instance = new AcademicsClassService();

  private constructor(
    private readonly classes = ClassRepository.Instance,
    private readonly levels = LevelRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchClasses(
    context: RequestContext,
    query: FetchClassesQuery,
  ): Promise<SchoolClassDTO[]> {
    // The register is the form teacher's job, not every teacher who passes
    // through the room, so the attendance picker asks for the narrower set.
    const allowedIds = query.formTeacherOnly
      ? await this.scope.formTeacherClassIds(context)
      : (await this.scope.forContext(context)).classIds;

    return this.classes.fetchForSchool(context.schoolId, {
      levelId: query.levelId,
      includeInactive: query.includeInactive,
      allowedIds,
    });
  }

  async fetchClass(context: RequestContext, id: string): Promise<SchoolClassDTO> {
    const record = await this.classes.findOneDTO(context.schoolId, id);
    if (!record) throw AppError.notFound('Class');

    // A class outside the caller's remit is "not found" rather than "forbidden":
    // its existence is not theirs to learn.
    const scope = await this.scope.forContext(context);
    if (scope.classIds && !scope.classIds.includes(record.id)) throw AppError.notFound('Class');

    return record;
  }

  async createClass(context: RequestContext, input: CreateClassInput): Promise<SchoolClassDTO> {
    const level = await this.levels.findByIdScoped(context.schoolId, input.levelId);
    if (!level) throw AppError.notFound('Level');

    const suffix = await this.classes.nextCodeSuffix(context.schoolId);
    const created = await this.classes.create({
      schoolId: context.schoolId,
      levelId: level.id,
      name: input.name,
      arm: input.arm?.trim() || null,
      code: `${level.code}-${String(suffix).padStart(2, '0')}`,
      capacity: input.capacity ?? 40,
      enrolledCount: 0,
      roomId: input.roomId ?? null,
      isActive: true,
    });

    if (input.formTeacherIds?.length) {
      // Filtered against this school's roster, so an id from elsewhere is
      // dropped rather than stored as a dangling reference.
      const valid = await this.classes.filterStaffIds(context.schoolId, input.formTeacherIds);
      await this.classes.replaceFormTeachers(context.schoolId, created.id, valid);
    }

    await this.audit.record(context, {
      action: 'academics.class_created',
      entityType: 'SchoolClass',
      entityId: created.id,
      entityLabel: created.name,
      after: { name: created.name, levelId: level.id, code: created.code },
    });

    const dto = await this.classes.findOneDTO(context.schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateClass(
    context: RequestContext,
    id: string,
    patch: UpdateClassInput,
  ): Promise<SchoolClassDTO> {
    const before = await this.classes.findOneDTO(context.schoolId, id);
    if (!before) throw AppError.notFound('Class');

    if (patch.levelId) {
      const level = await this.levels.findByIdScoped(context.schoolId, patch.levelId);
      if (!level) throw AppError.notFound('Level');
    }

    const { formTeacherIds, ...columns } = patch;
    await this.classes.update(id, columns);

    // Only touched when the key is actually present: an update that says
    // nothing about form teachers must not clear them.
    if (formTeacherIds !== undefined) {
      const valid = await this.classes.filterStaffIds(context.schoolId, formTeacherIds);
      await this.classes.replaceFormTeachers(context.schoolId, id, valid);
    }

    const after = await this.classes.findOneDTO(context.schoolId, id);
    if (!after) throw AppError.notFound('Class');

    await this.audit.record(context, {
      action: 'academics.class_updated',
      entityType: 'SchoolClass',
      entityId: id,
      entityLabel: after.name,
      before: { name: before.name, formTeacherIds: before.formTeacherIds },
      after: { name: after.name, formTeacherIds: after.formTeacherIds },
    });

    return after;
  }

  async removeClass(context: RequestContext, id: string): Promise<void> {
    const record = await this.classes.findOneDTO(context.schoolId, id);
    if (!record) throw AppError.notFound('Class');

    if (record.enrolledCount > 0) {
      throw AppError.conflict(
        `This class still has ${record.enrolledCount} pupil${record.enrolledCount === 1 ? '' : 's'} in it. Move them first.`,
      );
    }

    await this.classes.softDeleteScoped(context.schoolId, id);

    await this.audit.record(context, {
      action: 'academics.class_deleted',
      entityType: 'SchoolClass',
      entityId: id,
      entityLabel: record.name,
      before: { name: record.name },
      severity: 'WARNING',
    });
  }
}
