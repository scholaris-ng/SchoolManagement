import type { EntityManager } from 'typeorm';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AcademicSession } from '../../academics/entities/academicSession.entity';
import { SchoolLevel } from '../../academics/entities/schoolLevel.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Student } from '../../students/entities/student.entity';
import { StudentEnrollment } from '../../students/entities/studentEnrollment.entity';
import { StudentRepository } from '../../students/repositories/student.repository';
import type { StudentDTO } from '../../students/dto/students.dto';
import { Guardian } from '../../guardians/entities/guardian.entity';
import { StudentGuardian } from '../../guardians/entities/studentGuardian.entity';
import { WebsiteRepository } from '../../school/repositories/website.repository';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { AdmissionRepository } from '../repositories/admission.repository';
import {
  AdmissionApplication,
  type ApplicationContact,
  type ApplicationStatus,
} from '../entities/admissionApplication.entity';
import { AdmissionStageEvent } from '../entities/admissionStageEvent.entity';
import type {
  AdmissionApplicationDTO,
  PublicApplicationReceiptDTO,
} from '../dto/admissions.dto';
import type {
  ApplicantInput,
  ApplicationContactInput,
  ConvertAdmissionInput,
  CreateAdmissionInput,
  FetchAdmissionsQuery,
  PublicApplicationInput,
  TransitionAdmissionInput,
} from '../validators/admissions.schema';

/** Empty strings from an optional form field mean "not provided", not "set to blank". */
function nullIfBlank(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed ? trimmed : null;
}

/**
 * The order an application may move through (spec section 10), and the same
 * map the client offers as buttons. Enforced here because the client's copy is
 * only ever UX: a request that skips screening and offers a place directly is
 * refused whatever the caller's screen showed them.
 */
const ALLOWED_NEXT: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['SCREENING', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['OFFERED', 'REJECTED', 'WITHDRAWN'],
  OFFERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

/** Deciding a place is a heavier permission than keeping the list tidy. */
const DECISION_STATUSES: ApplicationStatus[] = ['OFFERED', 'ACCEPTED', 'REJECTED'];

/** One family, one session, one address: enough room to be genuine, not to flood. */
const MAX_APPLICATIONS_PER_CONTACT = 12;

export class AdmissionsService {
  static Instance = new AdmissionsService();

  private constructor(
    private readonly applications = AdmissionRepository.Instance,
    private readonly websites = WebsiteRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly audit = AuditService.Instance,
    private readonly notifications = NotificationsService.Instance,
  ) {}

  /* -- Reads ---------------------------------------------------------------- */

  async fetchApplications(
    context: RequestContext,
    query: FetchAdmissionsQuery,
  ): Promise<Paginated<AdmissionApplicationDTO>> {
    return this.applications.fetchPaginated(context.schoolId, query);
  }

  async fetchApplication(context: RequestContext, id: string): Promise<AdmissionApplicationDTO> {
    const application = await this.applications.findOneDTO(context.schoolId, id);
    if (!application) throw AppError.notFound('Application');
    return application;
  }

  /* -- Taken at the office -------------------------------------------------- */

  /**
   * An application keyed in by staff — a walk-in, or a paper form typed up
   * later. It lands as SUBMITTED rather than DRAFT: somebody handed it in.
   */
  async createApplication(
    context: RequestContext,
    input: CreateAdmissionInput,
  ): Promise<AdmissionApplicationDTO> {
    const { session, level } = await this.requireSessionAndLevel(
      context.schoolId,
      input.sessionId,
      input.levelId,
    );

    const duplicate = await this.applications.findDuplicate(context.schoolId, session.id, {
      firstName: input.applicant.firstName,
      lastName: input.applicant.lastName,
      dateOfBirth: input.applicant.dateOfBirth,
    });
    if (duplicate) {
      throw AppError.conflict(
        `${duplicate.firstName} ${duplicate.lastName} already has an application for ${session.name} (${duplicate.applicationNo}). Open that one instead of starting a second.`,
      );
    }

    const created = await AppDataSource.transaction(async (manager) => {
      const application = await this.insertApplication(manager, {
        schoolId: context.schoolId,
        sessionId: session.id,
        sessionName: session.name,
        levelId: level.id,
        applicantType: input.applicantType,
        source: 'OFFICE',
        applicant: input.applicant,
        contacts: this.normaliseContacts(input.contacts),
      });

      await this.appendStageEvent(manager, application, {
        status: 'SUBMITTED',
        actorUserId: context.user.id,
        actorName: context.user.displayName,
        note: 'Application recorded at the school office.',
      });

      return application;
    });

    await this.audit.record(context, {
      action: 'admission.created',
      entityType: 'AdmissionApplication',
      entityId: created.id,
      entityLabel: created.applicationNo,
      after: {
        applicant: `${created.firstName} ${created.lastName}`,
        level: level.name,
        session: session.name,
      },
    });

    return this.requireDTO(context.schoolId, created.id);
  }

  /* -- Submitted from the public website ------------------------------------ */

  /**
   * What the school publishes for its application form: the sessions open for
   * applications and the levels a child may be applied to. Unauthenticated, so
   * it carries names and ids and nothing else — no counts, no capacity, nothing
   * that describes a child (spec section 41).
   */
  async publicOptions(slug: string): Promise<{
    open: boolean;
    sessions: { id: string; name: string; isCurrent: boolean }[];
    levels: { id: string; name: string }[];
  }> {
    const website = await this.websites.findPublishedBySlug(slug);
    if (!website) throw AppError.notFound('School');
    if (!website.admissionsOpen) return { open: false, sessions: [], levels: [] };

    const [sessions, levels] = await Promise.all([
      AppDataSource.getRepository(AcademicSession).find({
        where: { schoolId: website.schoolId },
        order: { startDate: 'DESC' },
      }),
      AppDataSource.getRepository(SchoolLevel).find({
        where: { schoolId: website.schoolId },
        order: { sequence: 'ASC' },
      }),
    ]);

    return {
      open: true,
      // A closed session is history; nobody may apply into it.
      sessions: sessions
        .filter((session) => session.status !== 'CLOSED')
        .map((session) => ({ id: session.id, name: session.name, isCurrent: session.isCurrent })),
      levels: levels.map((level) => ({ id: level.id, name: level.name })),
    };
  }

  /**
   * A family applying through the school's own website.
   *
   * No session, no tenant header, no trusted caller — the slug is the only
   * thing identifying the school, and everything below treats the payload as
   * hostile. Note what this does NOT create: no user, no guardian record, no
   * student. It writes applications and the trail that says where they came
   * from, and nothing else. Promotion into people the school knows happens in
   * `convert`, after a place has been accepted.
   */
  async submitPublicApplication(
    slug: string,
    input: PublicApplicationInput,
    origin: { ipAddress: string | null; userAgent: string | null; requestId: string },
  ): Promise<PublicApplicationReceiptDTO> {
    const website = await this.websites.findPublishedBySlug(slug);
    if (!website) throw AppError.notFound('School');
    if (!website.admissionsOpen) {
      throw AppError.conflict(
        'This school is not accepting applications through its website at the moment. Please contact the school office.',
      );
    }

    const schoolId = website.schoolId;
    const school = await this.schools.findById(schoolId);
    if (!school) throw AppError.notFound('School');

    const session = await this.requireSession(schoolId, input.sessionId);
    const levels = await this.requireLevels(
      schoolId,
      input.applicants.map((applicant) => applicant.levelId),
    );

    const contacts = this.normaliseContacts(input.contacts);
    const primary = contacts.find((contact) => contact.isPrimaryContact) ?? contacts[0];

    // A genuine family files a handful; anything beyond that is somebody
    // testing the form. The rate limiter on the route bounds the burst, this
    // bounds the total against one address across sessions of the day.
    const already = await this.applications.countForContactEmail(
      schoolId,
      session.id,
      primary.email,
    );
    if (already + input.applicants.length > MAX_APPLICATIONS_PER_CONTACT) {
      throw AppError.conflict(
        'That email address already has several applications for this session. Please contact the school office instead.',
      );
    }

    for (const applicant of input.applicants) {
      const duplicate = await this.applications.findDuplicate(schoolId, session.id, applicant);
      if (duplicate) {
        throw AppError.conflict(
          `An application for ${applicant.firstName} ${applicant.lastName} has already been received for ${session.name}. Its reference is ${duplicate.applicationNo}.`,
        );
      }
    }

    const submittedAt = new Date();

    const created = await AppDataSource.transaction(async (manager) => {
      const rows: AdmissionApplication[] = [];

      for (const applicant of input.applicants) {
        const application = await this.insertApplication(manager, {
          schoolId,
          sessionId: session.id,
          sessionName: session.name,
          levelId: applicant.levelId,
          applicantType: input.applicantType,
          source: 'WEBSITE',
          applicant,
          contacts,
          status: 'SUBMITTED',
          submittedAt,
        });

        await this.appendStageEvent(manager, application, {
          status: 'SUBMITTED',
          actorUserId: null,
          // The family is the actor here, and the trail should say so rather
          // than name a member of staff who did nothing.
          actorName: `${primary.firstName} ${primary.lastName} (website)`,
          note:
            input.applicantType === 'SELF'
              ? 'Submitted by the applicant through the school website.'
              : 'Submitted by a parent or guardian through the school website.',
          occurredAt: submittedAt,
        });

        rows.push(application);
      }

      return rows;
    });

    await this.audit.recordSystem(schoolId, {
      actorName: `${primary.firstName} ${primary.lastName}`,
      action: 'admission.submitted.public',
      entityType: 'AdmissionApplication',
      entityId: created[0].id,
      entityLabel: created.map((row) => row.applicationNo).join(', '),
      after: {
        applicants: created.map((row) => `${row.firstName} ${row.lastName}`),
        contactEmail: primary.email,
        applicantType: input.applicantType,
        consentGiven: input.consentGiven,
      },
      ipAddress: origin.ipAddress,
      userAgent: origin.userAgent,
      requestId: origin.requestId,
    });

    void this.notifications.notifySchoolAdmins(schoolId, {
      category: 'ADMISSION',
      title:
        created.length === 1 ? 'New application from the website' : 'New applications from the website',
      body:
        created.length === 1
          ? `${created[0].firstName} ${created[0].lastName} applied for ${levels.get(created[0].levelId)?.name ?? 'a place'} (${created[0].applicationNo}).`
          : `${primary.firstName} ${primary.lastName} applied for ${created.length} children (${created.map((row) => row.applicationNo).join(', ')}).`,
      actionUrl: `/admissions/${created[0].id}`,
      severity: 'INFO',
      entityType: 'AdmissionApplication',
      entityId: created[0].id,
    });

    return {
      submittedAt: submittedAt.toISOString(),
      applications: created.map((row) => ({
        applicationNo: row.applicationNo,
        applicantName: [row.firstName, row.lastName].filter(Boolean).join(' '),
        levelName: levels.get(row.levelId)?.name ?? '',
      })),
      contactEmail: website.contactEmail || school.email,
    };
  }

  /* -- Moving through the stages -------------------------------------------- */

  async transition(
    context: RequestContext,
    id: string,
    input: TransitionAdmissionInput,
  ): Promise<AdmissionApplicationDTO> {
    const application = await this.applications.findByIdScoped(context.schoolId, id);
    if (!application) throw AppError.notFound('Application');

    if (application.convertedStudentId) {
      throw AppError.conflict(
        'This applicant has already been enrolled, so the application can no longer be changed.',
      );
    }

    const allowed = ALLOWED_NEXT[application.status];
    if (!allowed.includes(input.status)) {
      throw AppError.conflict(
        allowed.length === 0
          ? `This application is already ${application.status.toLowerCase()} and cannot be moved again.`
          : `An application that is ${application.status.toLowerCase()} can only move to ${allowed.join(', ').toLowerCase()}.`,
      );
    }

    if (DECISION_STATUSES.includes(input.status) && !context.can('admission.decide')) {
      throw AppError.forbidden('Deciding on a place is not yours to do.');
    }

    let offeredClass: SchoolClass | null = null;
    if (input.status === 'OFFERED') {
      if (!input.offeredClassId) {
        throw AppError.validation('Choose the class being offered.', [
          { field: 'offeredClassId', message: 'Choose the class being offered.' },
        ]);
      }
      offeredClass = await AppDataSource.getRepository(SchoolClass).findOne({
        where: { id: input.offeredClassId, schoolId: context.schoolId },
      });
      if (!offeredClass) throw AppError.notFound('Class');
    }

    const now = new Date();
    const columns: Record<string, unknown> = { status: input.status };

    if (input.screeningScore !== undefined) columns.screeningScore = input.screeningScore;
    if (offeredClass) columns.offeredClassId = offeredClass.id;
    if (input.offerExpiresOn) columns.offerExpiresOn = input.offerExpiresOn;
    if (nullIfBlank(input.note)) columns.decisionNote = nullIfBlank(input.note);
    if (input.status === 'SUBMITTED' && !application.submittedAt) columns.submittedAt = now;
    if (DECISION_STATUSES.includes(input.status)) columns.decidedAt = now;
    if (input.status === 'ACCEPTED') columns.acceptedAt = now;

    await AppDataSource.transaction(async (manager) => {
      await manager.update(AdmissionApplication, { id: application.id }, columns);
      await this.appendStageEvent(manager, application, {
        status: input.status,
        actorUserId: context.user.id,
        actorName: context.user.displayName,
        note: nullIfBlank(input.note),
        occurredAt: now,
      });
    });

    await this.audit.record(context, {
      action: `admission.${input.status.toLowerCase()}`,
      entityType: 'AdmissionApplication',
      entityId: application.id,
      entityLabel: application.applicationNo,
      before: { status: application.status },
      after: { status: input.status, note: nullIfBlank(input.note) },
      // A place offered or refused changes a child's year. It belongs in the
      // log at a weight somebody will notice.
      severity: DECISION_STATUSES.includes(input.status) ? 'WARNING' : 'INFO',
    });

    return this.requireDTO(context.schoolId, application.id);
  }

  /* -- Becoming a pupil ------------------------------------------------------ */

  /**
   * Turns an accepted applicant into an enrolled student, in one transaction
   * (spec section 10).
   *
   * This is also the only place in the system where an application's contacts
   * become `Guardian` records. That is the point the school has said yes: the
   * child has a place, the family is known to the office, and a parent portal
   * login, a fee liability and a listing in the parent directory are now things
   * the school means to create. Before that they were strangers who filled in a
   * form, and the platform treated them as such.
   *
   * A contact whose email already belongs to a guardian at this school is
   * linked rather than duplicated — a second child joining does not create a
   * second mother.
   */
  async convert(
    context: RequestContext,
    id: string,
    input: ConvertAdmissionInput,
  ): Promise<{ student: StudentDTO; applicationId: string }> {
    const application = await this.applications.findByIdScoped(context.schoolId, id);
    if (!application) throw AppError.notFound('Application');

    if (application.status !== 'ACCEPTED') {
      throw AppError.conflict(
        'Only an applicant who has accepted a place can be enrolled. Record the offer and their acceptance first.',
      );
    }
    if (application.convertedStudentId) {
      throw AppError.conflict('This applicant has already been enrolled.');
    }

    const schoolClass = await AppDataSource.getRepository(SchoolClass).findOne({
      where: { id: input.classId, schoolId: context.schoolId },
    });
    if (!schoolClass) throw AppError.notFound('Class');

    const clash = await AppDataSource.getRepository(Student).findOne({
      where: { schoolId: context.schoolId, admissionNo: input.admissionNo },
      withDeleted: true,
    });
    if (clash) throw AppError.conflict('That admission number is already in use.');

    const admissionDate = new Date().toISOString().slice(0, 10);

    const student = await AppDataSource.transaction(async (manager) => {
      const pupil = await manager.save(
        manager.create(Student, {
          schoolId: context.schoolId,
          admissionNo: input.admissionNo,
          firstName: application.firstName,
          middleName: application.middleName,
          lastName: application.lastName,
          gender: application.gender,
          dateOfBirth: application.dateOfBirth,
          admissionDate,
          status: 'ACTIVE',
          currentClassId: schoolClass.id,
          photoUrl: application.photoUrl,
          // Nothing the family typed into a web form counts as consent to
          // publish their child's photograph (spec section 41).
          photoConsent: false,
          bloodGroup: application.bloodGroup,
          medicalNotes: application.medicalNotes,
          address: application.address,
          nationality: application.nationality,
          stateOfOrigin: application.stateOfOrigin,
          customFields: {},
        }),
      );

      await manager.save(
        manager.create(StudentEnrollment, {
          schoolId: context.schoolId,
          studentId: pupil.id,
          // The session they applied for, not today's — a child admitted in
          // June for September belongs to next year's register.
          sessionId: application.sessionId,
          levelId: schoolClass.levelId,
          classId: schoolClass.id,
          status: 'ACTIVE',
          enrolledOn: admissionDate,
        }),
      );

      await manager.increment(SchoolClass, { id: schoolClass.id }, 'enrolledCount', 1);

      await this.promoteContacts(manager, context.schoolId, pupil.id, application.contacts);

      await manager.update(
        AdmissionApplication,
        { id: application.id },
        { convertedStudentId: pupil.id },
      );

      await this.appendStageEvent(manager, application, {
        status: 'ACCEPTED',
        actorUserId: context.user.id,
        actorName: context.user.displayName,
        note: `Enrolled as ${input.admissionNo} in ${schoolClass.name}.`,
      });

      return pupil;
    });

    await this.audit.record(context, {
      action: 'admission.converted',
      entityType: 'AdmissionApplication',
      entityId: application.id,
      entityLabel: application.applicationNo,
      after: {
        studentId: student.id,
        admissionNo: student.admissionNo,
        classId: schoolClass.id,
        guardiansCreated: application.contacts.length,
      },
      // Creating guardian records grants people access to a child's file.
      severity: 'WARNING',
    });

    void this.notifications.notifySchoolAdmins(context.schoolId, {
      category: 'ADMISSION',
      title: 'Applicant enrolled',
      body: `${student.firstName} ${student.lastName} (${student.admissionNo}) joined ${schoolClass.name}.`,
      actionUrl: `/students/${student.id}`,
      severity: 'SUCCESS',
      entityType: 'Student',
      entityId: student.id,
      exceptUserId: context.user.id,
    });

    // Read back through the students module's own projection, so the record
    // the client receives here is identical to the one it would get from the
    // students endpoint — the conversion dialog navigates straight to it.
    const dto = await StudentRepository.Instance.findOneDTO(context.schoolId, student.id);
    if (!dto) throw AppError.internal();

    return { student: dto, applicationId: application.id };
  }

  /* -- The funnel ----------------------------------------------------------- */

  /**
   * Read by the admissions screen and by analytics, so it lives here with the
   * table rather than being recomputed in two places.
   */
  async funnel(
    schoolId: string,
    sessionId: string | null,
    sessionName: string,
  ): Promise<{
    sessionName: string;
    received: number;
    screened: number;
    shortlisted: number;
    offered: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
    conversionRate: number;
    trend: { label: string; applications: number; accepted: number }[];
    byLevel: { levelName: string; applications: number; offered: number; accepted: number }[];
  }> {
    const [current, reached, byLevel, trend] = await Promise.all([
      this.applications.countsByStatus(schoolId, sessionId),
      this.applications.reachedByStage(schoolId, sessionId),
      this.applications.funnelByLevel(schoolId, sessionId),
      this.applications.monthlyTrend(schoolId, sessionId),
    ]);

    const received = Object.values(current).reduce((sum, count) => sum + count, 0) - current.DRAFT;
    const accepted = reached.ACCEPTED;

    return {
      sessionName,
      received,
      // Stages are "how many ever got this far", from the trail — an applicant
      // who was screened and then rejected was still screened.
      screened: reached.SCREENING,
      shortlisted: reached.SHORTLISTED,
      offered: reached.OFFERED,
      accepted,
      rejected: current.REJECTED,
      withdrawn: current.WITHDRAWN,
      // A percentage, not a fraction: `formatPercent` on the client appends
      // the sign rather than scaling, the same as every other rate it renders.
      conversionRate: received > 0 ? Math.round((accepted / received) * 1000) / 10 : 0,
      trend,
      byLevel,
    };
  }

  /* -- Internals ------------------------------------------------------------ */

  private async insertApplication(
    manager: EntityManager,
    params: {
      schoolId: string;
      sessionId: string;
      sessionName: string;
      levelId: string;
      applicantType: 'GUARDIAN' | 'SELF';
      source: 'OFFICE' | 'WEBSITE';
      applicant: ApplicantInput;
      contacts: ApplicationContact[];
      status?: ApplicationStatus;
      submittedAt?: Date;
    },
  ): Promise<AdmissionApplication> {
    const sequence = await this.applications.nextSequence(
      manager,
      params.schoolId,
      params.sessionId,
    );
    const submittedAt = params.submittedAt ?? new Date();
    const isSelf = params.applicantType === 'SELF';

    return manager.save(
      manager.create(AdmissionApplication, {
        schoolId: params.schoolId,
        applicationNo: applicationNumber(params.sessionName, sequence),
        sequence,
        sessionId: params.sessionId,
        levelId: params.levelId,
        applicantType: params.applicantType,
        source: params.source,
        firstName: params.applicant.firstName,
        middleName: nullIfBlank(params.applicant.middleName),
        lastName: params.applicant.lastName,
        gender: params.applicant.gender,
        dateOfBirth: params.applicant.dateOfBirth,
        photoUrl: params.applicant.photoUrl ?? null,
        nationality: nullIfBlank(params.applicant.nationality),
        stateOfOrigin: nullIfBlank(params.applicant.stateOfOrigin),
        address: nullIfBlank(params.applicant.address),
        city: nullIfBlank(params.applicant.city),
        state: nullIfBlank(params.applicant.state),
        previousSchool: nullIfBlank(params.applicant.previousSchool),
        previousClass: nullIfBlank(params.applicant.previousClass),
        bloodGroup: nullIfBlank(params.applicant.bloodGroup),
        medicalNotes: nullIfBlank(params.applicant.medicalNotes),
        // Held only where the applicant is the one applying. On a
        // parent-filed application these would be the parent's, and a parent's
        // address on the child's record is exactly the confusion `contacts`
        // exists to prevent.
        applicantEmail: isSelf ? nullIfBlank(params.applicant.email) : null,
        applicantPhone: isSelf ? nullIfBlank(params.applicant.phone) : null,
        contacts: params.contacts,
        status: params.status ?? 'SUBMITTED',
        submittedAt,
      }),
    );
  }

  private async appendStageEvent(
    manager: EntityManager,
    application: AdmissionApplication,
    event: {
      status: ApplicationStatus;
      actorUserId: string | null;
      actorName: string;
      note?: string | null;
      occurredAt?: Date;
    },
  ): Promise<void> {
    await manager.save(
      manager.create(AdmissionStageEvent, {
        schoolId: application.schoolId,
        applicationId: application.id,
        status: event.status,
        actorUserId: event.actorUserId,
        actorName: event.actorName,
        note: event.note ?? null,
        occurredAt: event.occurredAt ?? new Date(),
      }),
    );
  }

  /**
   * Exactly one primary contact, whatever the form sent.
   *
   * Nobody primary means the school has no address for the decision letter;
   * two means the second quietly wins wherever the code takes the first. The
   * caller's first choice is honoured and the rest are cleared.
   */
  private normaliseContacts(contacts: ApplicationContactInput[]): ApplicationContact[] {
    const primaryIndex = Math.max(
      0,
      contacts.findIndex((contact) => contact.isPrimaryContact),
    );

    return contacts.map((contact, index) => ({
      title: nullIfBlank(contact.title),
      firstName: contact.firstName,
      lastName: contact.lastName,
      relationship: contact.relationship,
      email: contact.email,
      phone: contact.phone,
      occupation: nullIfBlank(contact.occupation),
      address: nullIfBlank(contact.address),
      city: nullIfBlank(contact.city),
      state: nullIfBlank(contact.state),
      isPrimaryContact: index === primaryIndex,
    }));
  }

  /**
   * Contacts → guardians, once and only once, inside the conversion.
   *
   * Portal access is deliberately left closed. Enrolling a child creates the
   * record; opening the portal to them is a separate, deliberate invitation
   * from the guardians screen, which is what proves the address belongs to
   * them before it can read a child's file.
   */
  private async promoteContacts(
    manager: EntityManager,
    schoolId: string,
    studentId: string,
    contacts: ApplicationContact[],
  ): Promise<void> {
    for (const contact of contacts) {
      const existing = await manager.findOne(Guardian, {
        where: { schoolId, email: contact.email },
      });

      const guardian =
        existing ??
        (await manager.save(
          manager.create(Guardian, {
            schoolId,
            title: contact.title,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            occupation: contact.occupation,
            // `Guardian.address` is one free-text field; city and state were
            // collected separately on the application, so they are folded
            // back in here rather than dropped on the only hop where they
            // would otherwise vanish.
            address: combineAddress(contact.address, contact.city, contact.state),
            hasPortalAccess: false,
          }),
        ));

      await manager.save(
        manager.create(StudentGuardian, {
          schoolId,
          studentId,
          guardianId: guardian.id,
          relationship: contact.relationship,
          isPrimaryContact: contact.isPrimaryContact,
          isEmergencyContact: contact.isPrimaryContact,
          isFinanciallyResponsible: contact.isPrimaryContact,
          // Who may collect a child is a safeguarding decision the school
          // makes, not one a form fills in. A parent gets it because the
          // school already treats a parent that way; anyone else waits for
          // somebody in the office to say so.
          canPickUp: contact.relationship === 'FATHER' || contact.relationship === 'MOTHER',
        }),
      );
    }
  }

  private async requireSession(schoolId: string, sessionId: string): Promise<AcademicSession> {
    const session = await AppDataSource.getRepository(AcademicSession).findOne({
      where: { id: sessionId, schoolId },
    });
    if (!session) throw AppError.notFound('Academic session');
    return session;
  }

  private async requireSessionAndLevel(
    schoolId: string,
    sessionId: string,
    levelId: string,
  ): Promise<{ session: AcademicSession; level: SchoolLevel }> {
    const [session, level] = await Promise.all([
      this.requireSession(schoolId, sessionId),
      AppDataSource.getRepository(SchoolLevel).findOne({ where: { id: levelId, schoolId } }),
    ]);
    if (!level) throw AppError.notFound('Level');
    return { session, level };
  }

  /** Every level named in one submission, checked as belonging to this school. */
  private async requireLevels(
    schoolId: string,
    levelIds: string[],
  ): Promise<Map<string, SchoolLevel>> {
    const wanted = [...new Set(levelIds)];
    const levels = await AppDataSource.getRepository(SchoolLevel).find({ where: { schoolId } });
    const byId = new Map(levels.map((level) => [level.id, level]));

    for (const id of wanted) {
      if (!byId.has(id)) throw AppError.notFound('Level');
    }
    return byId;
  }

  private async requireDTO(schoolId: string, id: string): Promise<AdmissionApplicationDTO> {
    const dto = await this.applications.findOneDTO(schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
  }
}

/**
 * `APP/2025-2026/0007` — the school's session, then the count within it.
 *
 * A parent reads this back over the phone, so it is deliberately not a uuid.
 * The session's own name carries the year, which means a number stays
 * meaningful years later without a lookup.
 */
function applicationNumber(sessionName: string, sequence: number): string {
  const session = sessionName
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20)
    .toUpperCase();
  return `APP/${session || 'SESSION'}/${String(sequence).padStart(4, '0')}`;
}

/** A street line, city and state, joined the way a person would write them out. */
function combineAddress(
  address: string | null,
  city: string | null,
  state: string | null,
): string | null {
  const line = [address, city, state].filter(Boolean).join(', ');
  return line || null;
}
