import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { CollectionRepository } from '../repositories/collection.repository';
import type { CollectionEventDTO, PickupPersonDTO, StudentPickupDTO } from '../dto/collection.dto';
import type {
  CreatePickupPersonInput,
  FetchCollectionEventsQuery,
  ReleaseChildInput,
  UpdatePickupPersonInput,
} from '../validators/collection.schema';

/**
 * Child collection (spec section 12): who may take a child home, and the
 * record of each time somebody did.
 *
 * The pickup list is a safeguarding decision, so authorising a person is
 * stamped with who did it and when. The collection log is append-only — a
 * child leaving the premises is not something to be edited afterwards — and
 * every guardian with a portal account is told the moment it happens.
 */
export class CollectionService {
  static Instance = new CollectionService();

  private constructor(
    private readonly collection = CollectionRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly attendance = AttendanceRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly notifications = NotificationsService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /* -- The pickup list ------------------------------------------------------- */

  async fetchForStudent(context: RequestContext, studentId: string): Promise<StudentPickupDTO> {
    if (!(await this.access.canSeeStudent(context, studentId))) throw AppError.notFound('Student');
    const [persons, recentEvents] = await Promise.all([
      this.collection.personsForStudent(context.schoolId, studentId),
      this.collection.recentForStudent(context.schoolId, studentId, 10),
    ]);
    return { persons, recentEvents };
  }

  async addPerson(
    context: RequestContext,
    studentId: string,
    input: CreatePickupPersonInput,
  ): Promise<PickupPersonDTO> {
    const { schoolId } = context;
    const student = await this.students.findOneDTO(schoolId, studentId);
    if (!student) throw AppError.notFound('Student');

    const authorised = input.authorizationStatus === 'AUTHORIZED';
    const created = await this.collection.createPerson({
      schoolId,
      studentId,
      name: input.name,
      relationship: input.relationship,
      phone: input.phone,
      photoUrl: input.photoUrl ?? null,
      authorizationStatus: input.authorizationStatus,
      authorizedByName: authorised ? context.user.displayName : null,
      authorizedAt: authorised ? new Date() : null,
      note: input.note ?? null,
    });

    await this.audit.record(context, {
      action: 'collection.pickup_person_added',
      entityType: 'Student',
      entityId: studentId,
      entityLabel: student.fullName,
      after: { name: input.name, relationship: input.relationship, status: input.authorizationStatus },
      // Who may collect a child is a safeguarding decision.
      severity: 'WARNING',
    });

    const dto = await this.collection.findPersonDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /** A change of status re-stamps who decided it; revoking clears the stamp. */
  async updatePerson(
    context: RequestContext,
    studentId: string,
    id: string,
    patch: UpdatePickupPersonInput,
  ): Promise<PickupPersonDTO> {
    const { schoolId } = context;
    const existing = await this.collection.findPersonDTO(schoolId, id);
    if (!existing || existing.studentId !== studentId) throw AppError.notFound('Pickup person');

    const columns: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) columns[key] = value;
    }
    if (patch.authorizationStatus && patch.authorizationStatus !== existing.authorizationStatus) {
      const authorised = patch.authorizationStatus === 'AUTHORIZED';
      columns.authorizedByName = authorised ? context.user.displayName : null;
      columns.authorizedAt = authorised ? new Date() : null;
    }
    if (Object.keys(columns).length > 0) {
      await this.collection.updatePerson(schoolId, id, columns);
      await this.audit.record(context, {
        action: 'collection.pickup_person_updated',
        entityType: 'Student',
        entityId: studentId,
        before: { name: existing.name, status: existing.authorizationStatus },
        after: { name: patch.name ?? existing.name, status: patch.authorizationStatus ?? existing.authorizationStatus },
        severity: 'WARNING',
      });
    }

    const dto = await this.collection.findPersonDTO(schoolId, id);
    if (!dto) throw AppError.notFound('Pickup person');
    return dto;
  }

  /* -- The log --------------------------------------------------------------- */

  async fetchEvents(
    context: RequestContext,
    query: FetchCollectionEventsQuery,
  ): Promise<Paginated<CollectionEventDTO>> {
    return this.collection.fetchEvents(context.schoolId, {
      ...query,
      visibleIds: await this.access.visibleStudentIds(context),
    });
  }

  /**
   * Records the child leaving. A person from the list must currently be
   * authorised; a name typed at the gate is allowed but recorded as exactly
   * that, so the log shows the difference. Guardians are told afterwards,
   * and a notification that fails does not unrecord a child who has gone.
   */
  async releaseChild(context: RequestContext, input: ReleaseChildInput): Promise<CollectionEventDTO> {
    const { schoolId } = context;
    const student = await this.students.findOneDTO(schoolId, input.studentId);
    if (!student) throw AppError.notFound('Student');

    let personName = input.pickupPersonName;
    let relationship = input.relationship;
    if (input.pickupPersonId) {
      const person = await this.collection.findPersonDTO(schoolId, input.pickupPersonId);
      if (!person || person.studentId !== student.id) throw AppError.notFound('Pickup person');
      if (person.authorizationStatus !== 'AUTHORIZED') {
        throw AppError.validation(
          `${person.name} is not authorised to collect ${student.fullName}. Authorise them on the pickup list first.`,
        );
      }
      personName = person.name;
      relationship = person.relationship;
    }
    if (!relationship) relationship = input.method === 'SELF' ? 'Self' : 'Unlisted';

    const created = await this.collection.createEvent({
      schoolId,
      studentId: student.id,
      pickupPersonId: input.pickupPersonId ?? null,
      pickupPersonName: personName,
      relationship,
      releasedByUserId: context.user.id,
      releasedByName: context.user.displayName,
      releasedAt: new Date(),
      method: input.method,
      parentNotified: false,
      note: input.note ?? null,
    });

    const recipients = await this.attendance.guardianRecipientsFor(schoolId, [student.id]);
    if (recipients.length > 0) {
      await this.notifications.notifyUsers(
        schoolId,
        recipients.map((row) => row.userId),
        {
          category: 'COLLECTION',
          title: `${student.fullName} has been collected`,
          body: `${student.fullName} left school with ${personName} (${relationship}) at ${formatTime(created.releasedAt)}, released by ${context.user.displayName}.`,
          actionUrl: `/family/${student.id}`,
          severity: 'INFO',
          entityType: 'CollectionEvent',
          entityId: created.id,
          exceptUserId: context.user.id,
        },
      );
      await this.collection.markParentNotified(schoolId, created.id);
    }

    await this.audit.record(context, {
      action: 'collection.child_released',
      entityType: 'Student',
      entityId: student.id,
      entityLabel: student.fullName,
      after: { to: personName, relationship, method: input.method, guardiansTold: recipients.length },
    });

    const dto = await this.collection.findEventDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
}
