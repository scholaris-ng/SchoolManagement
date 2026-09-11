import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { AttendanceRepository, type SavedMarkRow } from '../repositories/attendance.repository';
import type { SchoolClassDTO, TermDTO } from '../../academics/dto/academics.dto';
import type { AttendanceRegisterDTO, SaveRegisterResultDTO } from '../dto/attendance.dto';
import type { FetchRegisterQuery, SaveRegisterInput } from '../validators/attendance.schema';

/**
 * Taking the register (spec section 11).
 *
 * Two operations, and the difference between them is the whole design: reading
 * a register always answers with the class list, marked or not, so a teacher
 * can start marking; writing one is refused outright unless the day is genuinely
 * open. Nothing here invents a mark, and nothing reports a guardian as told when
 * they were not.
 */
export class AttendanceService {
  static Instance = new AttendanceService();

  private constructor(
    private readonly attendance = AttendanceRepository.Instance,
    private readonly classes = ClassRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly notifications = NotificationsService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchRegister(
    context: RequestContext,
    query: FetchRegisterQuery,
  ): Promise<AttendanceRegisterDTO> {
    const schoolClass = await this.resolveClass(context, query.classId);
    const terms = await this.terms.fetchForSchool(context.schoolId);

    const [records, meta] = await Promise.all([
      this.attendance.fetchRegister(context.schoolId, schoolClass.id, query.date),
      this.attendance.fetchRegisterMeta(context.schoolId, schoolClass.id, query.date),
    ]);

    const covering = termCovering(terms, query.date);
    const current = currentTerm(terms);

    return {
      schoolId: context.schoolId,
      classId: schoolClass.id,
      className: schoolClass.name,
      date: query.date,
      // The term the day belongs to. A day outside every term has no term, and
      // the current one is the closest true answer for a screen that has to
      // name something.
      termId: covering?.id ?? current?.id ?? '',
      isLocked: isLocked(query.date, current),
      takenByName: meta?.takenByName ?? null,
      takenAt: meta?.takenAt ?? null,
      records,
    };
  }

  /**
   * Saves a register and, for a same-day absence, tells the guardians once.
   *
   * The reply counts both, because the client says both out loud: how many
   * marks were stored, and how many guardians heard about an absence.
   */
  async saveRegister(
    context: RequestContext,
    input: SaveRegisterInput,
  ): Promise<SaveRegisterResultDTO> {
    const schoolClass = await this.resolveClass(context, input.classId);
    const terms = await this.terms.fetchForSchool(context.schoolId);
    const current = currentTerm(terms);

    if (isLocked(input.date, current)) {
      throw AppError.conflict(
        'That date is outside the current term, so its register cannot be changed.',
      );
    }

    // Guaranteed by the lock above: a date inside the current term is inside a
    // term, so there is always one to file the marks under.
    const term = termCovering(terms, input.date) ?? current!;

    const roster = new Set(
      await this.attendance.rosterStudentIds(context.schoolId, schoolClass.id, input.date),
    );
    const strangers = input.marks.filter((mark) => !roster.has(mark.studentId));
    if (strangers.length > 0) {
      // Refused rather than quietly dropped. A mark for somebody who is not on
      // this class list means the screen and the school disagree about who is
      // in the room, and silently losing one child's mark is the worst possible
      // way to resolve that.
      throw AppError.validation(
        strangers.length === 1
          ? 'One of those pupils is not on this class list. Reload the register and try again.'
          : `${strangers.length} of those pupils are not on this class list. Reload the register and try again.`,
      );
    }

    const saved = await this.attendance.saveMarks(context.schoolId, {
      classId: schoolClass.id,
      termId: term.id,
      date: input.date,
      marks: input.marks,
      markedByUserId: context.user.id,
      markedByName: context.user.displayName,
    });

    const notificationsSent = await this.alertGuardians(context, {
      className: schoolClass.name,
      date: input.date,
      marks: saved,
    });

    await this.audit.record(context, {
      action: 'attendance.register_saved',
      entityType: 'AttendanceRegister',
      // A register is identified by its class and its day, not by a row.
      entityId: `${schoolClass.id}:${input.date}`,
      entityLabel: `${schoolClass.name} — ${input.date}`,
      after: {
        marked: saved.length,
        absent: saved.filter((mark) => mark.status === 'ABSENT').length,
        guardiansNotified: notificationsSent,
      },
    });

    return { saved: saved.length, notificationsSent };
  }

  /* -- Internals ------------------------------------------------------------- */

  /**
   * The class, if this caller may take its register at all.
   *
   * `formTeacherClassIds` is the right question rather than the broader
   * `forContext`: teaching a subject to a class is enough to see its curriculum,
   * but the daily register belongs to the form teacher. A class outside that set
   * is "not found" rather than "forbidden" — a register names every child in a
   * room, and its existence is not the caller's to learn.
   */
  private async resolveClass(
    context: RequestContext,
    classId: string,
  ): Promise<SchoolClassDTO> {
    const record = await this.classes.findOneDTO(context.schoolId, classId);
    if (!record) throw AppError.notFound('Class');

    const allowed = await this.scope.formTeacherClassIds(context);
    if (allowed && !allowed.includes(record.id)) throw AppError.notFound('Class');

    return record;
  }

  /**
   * The same-day absence alert (spec section 11).
   *
   * Only today, only an absence, and only once. Telling a parent on Friday that
   * their child missed Tuesday is a report rather than an alert, `LATE` and
   * `EXCUSED` are not news, and a register corrected at four o'clock must not
   * message a guardian who was already told at nine — which is what the
   * untouched `guardian_notified_at` on each mark records.
   *
   * Guardians with no account, or whose portal access has been withdrawn, have
   * no inbox to write to; those absences stay unstamped so they are not counted
   * as notified, here or later.
   */
  private async alertGuardians(
    context: RequestContext,
    register: { className: string; date: string; marks: SavedMarkRow[] },
  ): Promise<number> {
    if (register.date !== todayIso()) return 0;

    const fresh = register.marks.filter(
      (mark) => mark.status === 'ABSENT' && mark.guardianNotifiedAt === null,
    );
    if (fresh.length === 0) return 0;

    const recipients = await this.attendance.guardianRecipientsFor(
      context.schoolId,
      fresh.map((mark) => mark.studentId),
    );
    if (recipients.length === 0) return 0;

    const byStudent = new Map<string, { studentName: string; userIds: string[] }>();
    for (const row of recipients) {
      const entry = byStudent.get(row.studentId) ?? { studentName: row.studentName, userIds: [] };
      entry.userIds.push(row.userId);
      byStudent.set(row.studentId, entry);
    }

    // One message per child, so a guardian with two absent children is told
    // about each of them by name rather than getting a count.
    await Promise.all(
      [...byStudent].map(([studentId, entry]) =>
        this.notifications.notifyUsers(context.schoolId, entry.userIds, {
          category: 'ATTENDANCE',
          title: 'Absence recorded today',
          body: `${entry.studentName} was marked absent from ${register.className} today. Please contact the school if this is unexpected.`,
          // The parent portal page for that child — a route a guardian can
          // actually open, unlike the register itself.
          actionUrl: `/family/${studentId}`,
          severity: 'WARNING',
          entityType: 'AttendanceRecord',
          entityId: studentId,
          exceptUserId: context.user.id,
        }),
      ),
    );

    await this.attendance.markGuardiansNotified(
      context.schoolId,
      fresh.filter((mark) => byStudent.has(mark.studentId)).map((mark) => mark.id),
    );

    // People, not messages: a guardian with two absent children today was told
    // twice but is one guardian, which is what the client's wording claims.
    return new Set(recipients.map((row) => row.userId)).size;
  }
}

/* -- Term arithmetic -------------------------------------------------------- */

function currentTerm(terms: TermDTO[]): TermDTO | null {
  return terms.find((term) => term.isCurrent) ?? null;
}

function termCovering(terms: TermDTO[], date: string): TermDTO | null {
  return terms.find((term) => date >= term.startDate && date <= term.endDate) ?? null;
}

/**
 * Whether the register may be changed, which is what the screen's padlock says:
 * a day outside the current term can be read but not written.
 *
 * A future date is locked too. The date picker stops at today, and a register
 * for a day that has not happened is not a correction anybody should be able to
 * make through a hand-built request.
 */
function isLocked(date: string, current: TermDTO | null): boolean {
  if (date > todayIso()) return true;
  if (!current) return true;
  return date < current.startDate || date > current.endDate;
}

/** Matching how the rest of the server reads "today" (`studentRelations.service`). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
