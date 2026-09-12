import type { EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult, safeSortColumn } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AdmissionApplication } from '../entities/admissionApplication.entity';
import type { ApplicationStatus } from '../entities/admissionApplication.entity';
import type { AdmissionApplicationDTO, AdmissionStageEventDTO } from '../dto/admissions.dto';

/**
 * Every column the client's `AdmissionApplication` needs, assembled in SQL.
 *
 * The applicant is nested rather than flat because that is the shape the form
 * posts and the detail screen reads; `json_build_object` does that here so the
 * service never walks a result set reshaping rows by hand.
 */
const PROJECTION = `
  a.id, a.school_id AS "schoolId", a.application_no AS "applicationNo",
  a.session_id AS "sessionId", s.name AS "sessionName",
  a.level_id AS "levelId", l.name AS "levelName",
  a.applicant_type AS "applicantType", a.source,
  json_build_object(
    'firstName', a.first_name,
    'middleName', a.middle_name,
    'lastName', a.last_name,
    'gender', a.gender,
    'dateOfBirth', a.date_of_birth,
    'photoUrl', a.photo_url,
    'nationality', a.nationality,
    'stateOfOrigin', a.state_of_origin,
    'address', a.address,
    'city', a.city,
    'state', a.state,
    'previousSchool', a.previous_school,
    'previousClass', a.previous_class,
    'bloodGroup', a.blood_group,
    'medicalNotes', a.medical_notes,
    'email', a.applicant_email,
    'phone', a.applicant_phone
  ) AS applicant,
  a.contacts,
  '[]'::json AS documents,
  a.status,
  a.screening_score::float AS "screeningScore",
  a.interview_date AS "interviewDate", a.interview_note AS "interviewNote",
  a.decision_note AS "decisionNote",
  a.offered_class_id AS "offeredClassId", c.name AS "offeredClassName",
  a.offer_expires_on AS "offerExpiresOn",
  a.submitted_at AS "submittedAt", a.decided_at AS "decidedAt", a.accepted_at AS "acceptedAt",
  a.converted_student_id AS "convertedStudentId",
  a.version
`;

const JOINS = `
  FROM admission_applications a
  JOIN academic_sessions s ON s.id = a.session_id
  JOIN school_levels l ON l.id = a.level_id
  LEFT JOIN school_classes c ON c.id = a.offered_class_id
`;

const SORTABLE: Record<string, string> = {
  applicantName: 'a.last_name',
  applicationNo: 'a.application_no',
  levelName: 'l.name',
  status: 'a.status',
  screeningScore: 'a.screening_score',
  submittedAt: 'a.submitted_at',
  createdAt: 'a.created_at',
};

export interface AdmissionFilter {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  status?: ApplicationStatus;
  levelId?: string;
  sessionId?: string;
}

/** One row of the funnel's per-level breakdown. */
export interface FunnelLevelRow {
  levelName: string;
  applications: number;
  offered: number;
  accepted: number;
}

export class AdmissionRepository extends TenantRepository<AdmissionApplication> {
  static Instance = new AdmissionRepository();

  private constructor() {
    super(AdmissionApplication, 'application');
  }

  async fetchPaginated(
    schoolId: string,
    filter: AdmissionFilter,
  ): Promise<Paginated<AdmissionApplicationDTO>> {
    const params: unknown[] = [schoolId];
    const where = ['a.school_id = $1', 'a.deleted_at IS NULL'];

    if (filter.status) {
      params.push(filter.status);
      where.push(`a.status = $${params.length}`);
    }
    if (filter.levelId) {
      params.push(filter.levelId);
      where.push(`a.level_id = $${params.length}`);
    }
    if (filter.sessionId) {
      params.push(filter.sessionId);
      where.push(`a.session_id = $${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      // The three things an office actually searches by: the child, the
      // number on the paperwork, and — because a parent rings about "my
      // application" — any contact's name, email or phone.
      where.push(
        `(a.first_name ILIKE $${i} OR a.last_name ILIKE $${i} OR a.application_no ILIKE $${i}
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(a.contacts) AS contact
            WHERE contact->>'firstName' ILIKE $${i} OR contact->>'lastName' ILIKE $${i}
               OR contact->>'email' ILIKE $${i} OR contact->>'phone' ILIKE $${i}
          ))`,
      );
    }

    const whereSql = where.join(' AND ');
    const orderBy = safeSortColumn(filter.sortBy, Object.keys(SORTABLE), 'submittedAt');
    const direction = filter.sortDir === 'desc' ? 'DESC' : 'ASC';

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total ${JOINS} WHERE ${whereSql}`,
      params,
    );

    const rows: AdmissionApplicationDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}, '[]'::json AS timeline
       ${JOINS}
       WHERE ${whereSql}
       ORDER BY ${SORTABLE[orderBy]} ${direction} NULLS LAST, a.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  /**
   * One application with its full history. The list above carries an empty
   * timeline on purpose — a page of fifty applications would otherwise drag
   * every decision anybody ever recorded along with it, to render none of them.
   */
  async findOneDTO(schoolId: string, id: string): Promise<AdmissionApplicationDTO | null> {
    const rows: AdmissionApplicationDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}, '[]'::json AS timeline
       ${JOINS}
       WHERE a.school_id = $1 AND a.id = $2 AND a.deleted_at IS NULL`,
      [schoolId, id],
    );
    const application = rows[0];
    if (!application) return null;

    application.timeline = await this.timelineFor(schoolId, id);
    return application;
  }

  async timelineFor(schoolId: string, applicationId: string): Promise<AdmissionStageEventDTO[]> {
    return this.repo.query(
      `SELECT e.id, e.status, e.actor_name AS "actorName",
              e.occurred_at AS "occurredAt", e.note
       FROM admission_stage_events e
       WHERE e.school_id = $1 AND e.application_id = $2
       ORDER BY e.occurred_at ASC, e.created_at ASC`,
      [schoolId, applicationId],
    );
  }

  /**
   * The next number in a session, allocated inside the caller's transaction.
   *
   * Two families submitting through the website at the same second would
   * otherwise both read the same MAX and collide on the unique index, so this
   * takes a transaction-scoped advisory lock keyed on the session. It is
   * released when the transaction ends, whichever way it ends.
   */
  async nextSequence(manager: EntityManager, schoolId: string, sessionId: string): Promise<number> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `admission:${schoolId}:${sessionId}`,
    ]);
    const [row] = await manager.query(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next
       FROM admission_applications
       WHERE school_id = $1 AND session_id = $2`,
      [schoolId, sessionId],
    );
    return Number(row?.next ?? 1);
  }

  /** Applications already filed against this session by the same email address. */
  async countForContactEmail(
    schoolId: string,
    sessionId: string,
    email: string,
  ): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int AS total
       FROM admission_applications a
       WHERE a.school_id = $1 AND a.session_id = $2 AND a.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(a.contacts) AS contact
           WHERE lower(contact->>'email') = lower($3)
         )`,
      [schoolId, sessionId, email],
    );
    return Number(row?.total ?? 0);
  }

  /** The same child, already applying for the same session — a double submit. */
  async findDuplicate(
    schoolId: string,
    sessionId: string,
    applicant: { firstName: string; lastName: string; dateOfBirth: string },
  ): Promise<AdmissionApplication | null> {
    return this.repo
      .createQueryBuilder('a')
      .where('a.schoolId = :schoolId', { schoolId })
      .andWhere('a.sessionId = :sessionId', { sessionId })
      .andWhere('LOWER(a.firstName) = LOWER(:firstName)', { firstName: applicant.firstName })
      .andWhere('LOWER(a.lastName) = LOWER(:lastName)', { lastName: applicant.lastName })
      .andWhere('a.dateOfBirth = :dateOfBirth', { dateOfBirth: applicant.dateOfBirth })
      .getOne();
  }

  // ─── The funnel, read by both the admissions screen and analytics ─────────

  async countsByStatus(
    schoolId: string,
    sessionId: string | null,
  ): Promise<Record<ApplicationStatus, number>> {
    const rows: { status: ApplicationStatus; total: number }[] = await this.repo.query(
      `SELECT a.status, COUNT(*)::int AS total
       FROM admission_applications a
       WHERE a.school_id = $1 AND a.deleted_at IS NULL
         AND ($2::uuid IS NULL OR a.session_id = $2)
       GROUP BY a.status`,
      [schoolId, sessionId],
    );

    const counts = {
      DRAFT: 0,
      SUBMITTED: 0,
      SCREENING: 0,
      SHORTLISTED: 0,
      OFFERED: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    } as Record<ApplicationStatus, number>;

    for (const row of rows) counts[row.status] = Number(row.total);
    return counts;
  }

  /**
   * How many applications reached each stage at some point, not how many sit
   * there now. An application that was screened and then rejected was still
   * screened, and a funnel that forgot it would report a school as screening
   * fewer children than it did.
   */
  async reachedByStage(
    schoolId: string,
    sessionId: string | null,
  ): Promise<Record<ApplicationStatus, number>> {
    const rows: { status: ApplicationStatus; total: number }[] = await this.repo.query(
      `SELECT e.status, COUNT(DISTINCT e.application_id)::int AS total
       FROM admission_stage_events e
       JOIN admission_applications a ON a.id = e.application_id AND a.deleted_at IS NULL
       WHERE e.school_id = $1 AND ($2::uuid IS NULL OR a.session_id = $2)
       GROUP BY e.status`,
      [schoolId, sessionId],
    );

    const counts = {
      DRAFT: 0,
      SUBMITTED: 0,
      SCREENING: 0,
      SHORTLISTED: 0,
      OFFERED: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    } as Record<ApplicationStatus, number>;

    for (const row of rows) counts[row.status] = Number(row.total);
    return counts;
  }

  async funnelByLevel(schoolId: string, sessionId: string | null): Promise<FunnelLevelRow[]> {
    return this.repo.query(
      `SELECT l.name AS "levelName",
              COUNT(*)::int AS applications,
              COUNT(*) FILTER (WHERE a.status IN ('OFFERED', 'ACCEPTED'))::int AS offered,
              COUNT(*) FILTER (WHERE a.status = 'ACCEPTED')::int AS accepted
       FROM admission_applications a
       JOIN school_levels l ON l.id = a.level_id
       WHERE a.school_id = $1 AND a.deleted_at IS NULL
         AND ($2::uuid IS NULL OR a.session_id = $2)
       GROUP BY l.id, l.name, l.sequence
       ORDER BY l.sequence ASC`,
      [schoolId, sessionId],
    );
  }

  /** Applications and acceptances by month, for the trend on the funnel chart. */
  async monthlyTrend(
    schoolId: string,
    sessionId: string | null,
  ): Promise<{ label: string; applications: number; accepted: number }[]> {
    const rows: { label: string; applications: number; accepted: number }[] =
      await this.repo.query(
        `SELECT to_char(date_trunc('month', a.created_at), 'Mon YYYY') AS label,
                COUNT(*)::int AS applications,
                COUNT(*) FILTER (WHERE a.status = 'ACCEPTED')::int AS accepted,
                date_trunc('month', a.created_at) AS bucket
         FROM admission_applications a
         WHERE a.school_id = $1 AND a.deleted_at IS NULL
           AND ($2::uuid IS NULL OR a.session_id = $2)
         GROUP BY bucket
         ORDER BY bucket ASC
         LIMIT 24`,
        [schoolId, sessionId],
      );

    return rows.map((row) => ({
      label: row.label,
      applications: Number(row.applications),
      accepted: Number(row.accepted),
    }));
  }
}
