import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import { AuditService } from '../../audit/services/audit.service';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { SubjectRepository } from '../../academics/repositories/subject.repository';
import { PeriodRepository, RoomRepository } from '../../academics/repositories/facility.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import {
  TimetableEntryRepository,
  type EntryVisibility,
} from '../repositories/timetableEntry.repository';
import type { TimetableDTO, TimetableEntryDTO } from '../dto/timetable.dto';
import type { SaveEntryInput } from '../validators/timetable.schema';
import type { TermDTO } from '../../academics/dto/academics.dto';
import type { Weekday } from '../entities/timetableEntry.entity';

const DAY_LABEL: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
};

/**
 * The timetable (spec section 16).
 *
 * A term's timetable is the set of lessons placed into the school's periods
 * for that term; the term's id is the timetable's id. There is no separate
 * timetable row to create, publish or version — a grid exists for every term
 * the moment the school has bell times, empty until somebody fills it.
 *
 * Placing a lesson is the one piece of judgement here. The server is the only
 * place that can see every class's grid at once, so it is where a clash is
 * caught: a class, a teacher and a room can each be in one place per period,
 * and a placement that would double-book any of them is refused with a message
 * naming what it clashed with. The database's unique indexes back that up for
 * two people building the grid at the same moment.
 */
export class TimetableService {
  static Instance = new TimetableService();

  private constructor(
    private readonly entries = TimetableEntryRepository.Instance,
    private readonly periods = PeriodRepository.Instance,
    private readonly rooms = RoomRepository.Instance,
    private readonly classes = ClassRepository.Instance,
    private readonly subjects = SubjectRepository.Instance,
    private readonly staff = StaffRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /**
   * The current term's grid, narrowed to what the caller may see: the whole
   * school for anyone with oversight, a teacher's own lessons plus their form
   * class in full, a pupil's (or a parent's children's) own class.
   */
  async fetchCurrent(
    context: RequestContext,
    filter: { classId?: string; teacherId?: string; subjectId?: string },
  ): Promise<TimetableDTO> {
    const { schoolId } = context;

    const [periods, terms, visibility] = await Promise.all([
      this.periods.fetchForSchool(schoolId),
      this.terms.fetchForSchool(schoolId),
      this.visibilityFor(context),
    ]);

    const current = terms.find((term) => term.isCurrent);
    // Without a current term there is no "current timetable" to ask for, and
    // saying so is more useful than an object with empty term fields.
    if (!current) throw AppError.notFound('Current term');

    const entries = await this.entries.fetchForTerm(schoolId, current.id, {
      ...filter,
      visibility,
    });

    return {
      id: current.id,
      schoolId,
      name: `${current.name} timetable`,
      sessionId: current.sessionId,
      termId: current.id,
      termName: `${current.name}, ${current.sessionName}`,
      status: 'PUBLISHED',
      periods,
      entries,
      version: 0,
    };
  }

  /** Places a lesson, or moves one when `entryId` names it. */
  async saveEntry(
    context: RequestContext,
    timetableId: string,
    input: SaveEntryInput,
  ): Promise<TimetableEntryDTO> {
    const { schoolId } = context;
    const term = await this.resolveTerm(schoolId, timetableId);

    const [period, schoolClass, subject, teacherExists, room] = await Promise.all([
      this.periods.findOneDTO(schoolId, input.periodId),
      this.classes.findOneDTO(schoolId, input.classId),
      this.subjects.findOneDTO(schoolId, input.subjectId),
      this.staff.existsScoped(schoolId, input.teacherId),
      input.roomId ? this.rooms.findOneDTO(schoolId, input.roomId) : Promise.resolve(null),
    ]);
    if (!period) throw AppError.notFound('Period');
    if (!schoolClass) throw AppError.notFound('Class');
    if (!subject) throw AppError.notFound('Subject');
    if (!teacherExists) throw AppError.notFound('Teacher');
    if (input.roomId && !room) throw AppError.notFound('Room');

    if (period.isBreak) {
      throw AppError.validation(`${period.name} is a break — nothing can be timetabled into it.`);
    }

    if (input.entryId) {
      const existing = await this.entries.findOneDTO(schoolId, input.entryId);
      if (!existing || existing.timetableId !== term.id) throw AppError.notFound('Lesson');
    }

    await this.refuseClashes(schoolId, term.id, input, `on ${DAY_LABEL[input.day]} in ${period.name}`);

    const columns = {
      classId: input.classId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      roomId: input.roomId ?? null,
      periodId: input.periodId,
      day: input.day,
    };

    let entryId = input.entryId;
    try {
      if (entryId) {
        await this.entries.move(schoolId, entryId, columns);
      } else {
        const placed = await this.entries.place({ schoolId, termId: term.id, ...columns });
        entryId = placed.id;
      }
    } catch (error) {
      // Somebody else filled the slot between the check above and this write.
      if (isUniqueViolation(error)) {
        throw AppError.conflict(
          `That slot was taken a moment ago by someone else. Reload the timetable and try again.`,
        );
      }
      throw error;
    }

    const saved = await this.entries.findOneDTO(schoolId, entryId);
    if (!saved) throw AppError.internal();

    await this.audit.record(context, {
      action: input.entryId ? 'timetable.lesson_moved' : 'timetable.lesson_placed',
      entityType: 'TimetableEntry',
      entityId: saved.id,
      entityLabel: `${saved.className} · ${saved.subjectName} · ${DAY_LABEL[saved.day]} ${saved.periodName}`,
      after: {
        termId: term.id,
        classId: saved.classId,
        subjectId: saved.subjectId,
        teacherId: saved.teacherId,
        roomId: saved.roomId,
        day: saved.day,
        periodId: saved.periodId,
      },
    });

    return saved;
  }

  async removeEntry(context: RequestContext, timetableId: string, entryId: string): Promise<void> {
    const { schoolId } = context;
    const term = await this.resolveTerm(schoolId, timetableId);

    const existing = await this.entries.findOneDTO(schoolId, entryId);
    if (!existing || existing.timetableId !== term.id) throw AppError.notFound('Lesson');

    await this.entries.remove(schoolId, entryId);

    await this.audit.record(context, {
      action: 'timetable.lesson_removed',
      entityType: 'TimetableEntry',
      entityId: entryId,
      entityLabel: `${existing.className} · ${existing.subjectName} · ${DAY_LABEL[existing.day]} ${existing.periodName}`,
      before: {
        termId: term.id,
        classId: existing.classId,
        subjectId: existing.subjectId,
        teacherId: existing.teacherId,
        day: existing.day,
        periodId: existing.periodId,
      },
    });
  }

  /** Wipes every lesson in the term — every class, not just a filtered view. */
  async clearEntries(context: RequestContext, timetableId: string): Promise<{ removed: number }> {
    const { schoolId } = context;
    const term = await this.resolveTerm(schoolId, timetableId);

    const removed = await this.entries.clearTerm(schoolId, term.id);

    await this.audit.record(context, {
      action: 'timetable.cleared',
      entityType: 'Timetable',
      entityId: term.id,
      entityLabel: `${term.name}, ${term.sessionName}`,
      before: { lessons: removed },
      // A whole term's timetable gone in one click is worth noticing.
      severity: 'WARNING',
    });

    return { removed };
  }

  /* -- Internals ------------------------------------------------------------- */

  private async resolveTerm(schoolId: string, timetableId: string): Promise<TermDTO> {
    const term = await this.terms.findOneDTO(schoolId, timetableId);
    if (!term) throw AppError.notFound('Timetable');
    return term;
  }

  /**
   * Refuses the placement if the class, the teacher or the room is already
   * somewhere else in that slot, naming the lesson it would collide with. The
   * lesson being moved is not its own clash.
   */
  private async refuseClashes(
    schoolId: string,
    termId: string,
    input: SaveEntryInput,
    when: string,
  ): Promise<void> {
    const occupants = await this.entries.lessonsInSlot(schoolId, {
      termId,
      day: input.day,
      periodId: input.periodId,
    });

    for (const lesson of occupants) {
      if (lesson.id === input.entryId) continue;

      if (lesson.classId === input.classId) {
        throw AppError.conflict(
          `${lesson.className} already has ${lesson.subjectName} with ${lesson.teacherName} ${when}.`,
        );
      }
      if (lesson.teacherId === input.teacherId) {
        throw AppError.conflict(
          `${lesson.teacherName} is already teaching ${lesson.subjectName} to ${lesson.className} ${when}.`,
        );
      }
      if (input.roomId && lesson.roomId === input.roomId) {
        throw AppError.conflict(
          `${lesson.roomName} is already being used by ${lesson.className} for ${lesson.subjectName} ${when}.`,
        );
      }
    }
  }

  private async visibilityFor(context: RequestContext): Promise<EntryVisibility> {
    const { staffId, studentId, guardianId } = context.membership;

    // A teacher sees their own lessons and their form class in full.
    const formClasses = await this.scope.formTeacherClassIds(context);
    if (formClasses !== null) return { classIds: formClasses, ownTeacherId: staffId };

    // A pupil sees their own class; a parent, their children's.
    if (studentId || guardianId) {
      const scope = await this.scope.forContext(context);
      return { classIds: scope.classIds ?? [], ownTeacherId: null };
    }

    return { classIds: null, ownTeacherId: null };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      ((error as { code?: string }).code === '23505' ||
        (error as { driverError?: { code?: string } }).driverError?.code === '23505'),
  );
}
