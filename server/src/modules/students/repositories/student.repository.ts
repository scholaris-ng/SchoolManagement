import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult, safeSortColumn } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { Student } from '../entities/student.entity';
import type { StudentDTO, StudentSummaryDTO } from '../dto/students.dto';

/**
 * The projection the client's `Student` type expects.
 *
 * `fullName`, class and house names and the guardian count are joins and
 * aggregates rather than columns. Resolving them here is what keeps a register
 * of forty pupils one query instead of forty-one (spec section 43).
 */
const PROJECTION = `
  s.id, s.school_id AS "schoolId", s.admission_no AS "admissionNo",
  s.first_name AS "firstName", s.middle_name AS "middleName", s.last_name AS "lastName",
  concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "fullName",
  s.gender,
  to_char(s.date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
  s.photo_url AS "photoUrl", s.photo_consent AS "photoConsent",
  to_char(s.admission_date, 'YYYY-MM-DD') AS "admissionDate",
  s.status,
  s.current_class_id AS "currentClassId",
  c.name AS "currentClassName",
  l.name AS "currentLevelName",
  s.house_id AS "houseId",
  h.name AS "houseName",
  s.blood_group AS "bloodGroup", s.medical_notes AS "medicalNotes",
  s.emergency_contact_name AS "emergencyContactName",
  s.emergency_contact_phone AS "emergencyContactPhone",
  s.address, s.nationality, s.state_of_origin AS "stateOfOrigin", s.religion,
  s.custom_fields AS "customFields",
  (
    SELECT COUNT(*)::int FROM student_guardians sg WHERE sg.student_id = s.id
  ) AS "guardianCount",
  s.created_at AS "createdAt", s.updated_at AS "updatedAt", s.version
`;

const JOINS = `
  LEFT JOIN school_classes c ON c.id = s.current_class_id AND c.deleted_at IS NULL
  LEFT JOIN school_levels  l ON l.id = c.level_id         AND l.deleted_at IS NULL
  LEFT JOIN houses         h ON h.id = s.house_id         AND h.deleted_at IS NULL
`;

/** Only indexed columns, so a sort cannot turn a list into a table scan. */
const SORTABLE: Record<string, string> = {
  fullName: 's.last_name',
  lastName: 's.last_name',
  admissionNo: 's.admission_no',
  status: 's.status',
  createdAt: 's.created_at',
  className: 'c.name',
  currentClassName: 'c.name',
  dateOfBirth: 's.date_of_birth',
};

export interface StudentFilter {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  status?: string;
  classId?: string;
  levelId?: string;
  gender?: string;
  houseId?: string;
  /**
   * Row-level restriction for a parent or pupil. `null` means unrestricted;
   * an empty array means they may see none, which is not the same thing.
   */
  visibleIds: string[] | null;
}

export class StudentRepository extends TenantRepository<Student> {
  static Instance = new StudentRepository();

  private constructor() {
    super(Student, 'student');
  }

  async fetchPaginated(schoolId: string, filter: StudentFilter): Promise<Paginated<StudentDTO>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<StudentDTO>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where: string[] = ['s.school_id = $1', 's.deleted_at IS NULL'];

    const add = (clause: (index: number) => string, value: unknown) => {
      params.push(value);
      where.push(clause(params.length));
    };

    if (filter.visibleIds) add((i) => `s.id = ANY($${i}::uuid[])`, filter.visibleIds);
    if (filter.status) add((i) => `s.status = $${i}`, filter.status);
    if (filter.classId) add((i) => `s.current_class_id = $${i}`, filter.classId);
    if (filter.gender) add((i) => `s.gender = $${i}`, filter.gender);
    if (filter.houseId) add((i) => `s.house_id = $${i}`, filter.houseId);
    if (filter.levelId) add((i) => `c.level_id = $${i}`, filter.levelId);

    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.admission_no ILIKE $${i} OR c.name ILIKE $${i})`,
      );
    }

    const whereSql = where.join(' AND ');
    const orderBy = safeSortColumn(filter.sortBy, Object.keys(SORTABLE), 'lastName');
    const direction = filter.sortDir === 'desc' ? 'DESC' : 'ASC';

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM students s ${JOINS} WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRow?.total ?? 0);

    const rows: StudentDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM students s ${JOINS}
       WHERE ${whereSql}
       ORDER BY ${SORTABLE[orderBy]} ${direction}, s.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, total);
  }

  /** The typeahead behind the command palette and every student picker. */
  async search(
    schoolId: string,
    term: string,
    limit: number,
    visibleIds: string[] | null,
  ): Promise<StudentSummaryDTO[]> {
    if (visibleIds && visibleIds.length === 0) return [];

    const params: unknown[] = [schoolId, `%${term}%`, limit];
    let scope = '';
    if (visibleIds) {
      params.push(visibleIds);
      scope = `AND s.id = ANY($${params.length}::uuid[])`;
    }

    return this.repo.query(
      `SELECT s.id, s.admission_no AS "admissionNo",
              concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "fullName",
              s.photo_url AS "photoUrl", s.photo_consent AS "photoConsent",
              c.name AS "className", s.status
       FROM students s
       LEFT JOIN school_classes c ON c.id = s.current_class_id
       WHERE s.school_id = $1 AND s.deleted_at IS NULL ${scope}
         AND (s.first_name ILIKE $2 OR s.last_name ILIKE $2 OR s.admission_no ILIKE $2)
       ORDER BY s.last_name ASC
       LIMIT $3`,
      params,
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<StudentDTO | null> {
    const rows: StudentDTO[] = await this.repo.query(
      `SELECT ${PROJECTION} FROM students s ${JOINS}
       WHERE s.school_id = $1 AND s.id = $2 AND s.deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByAdmissionNo(schoolId: string, admissionNo: string): Promise<Student | null> {
    return this.repo.findOne({ where: { schoolId, admissionNo }, withDeleted: true });
  }

  async create(data: DeepPartial<Student>): Promise<Student> {
    return this.repo.save(this.repo.create(data));
  }

  /** Guarded by the version the caller loaded (spec section 34). */
  async updateIfVersionMatches(
    id: string,
    expectedVersion: number,
    patch: DeepPartial<Student>,
  ): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Student)
      .set({ ...patch, version: () => 'version + 1' } as never)
      .where('id = :id AND version = :expectedVersion', { id, expectedVersion })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async update(id: string, patch: DeepPartial<Student>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  /** Ids of the children a guardian is linked to — the parent portal's whole scope. */
  async idsForGuardian(schoolId: string, guardianId: string): Promise<string[]> {
    const rows: { studentId: string }[] = await this.repo.query(
      `SELECT student_id AS "studentId" FROM student_guardians
       WHERE school_id = $1 AND guardian_id = $2`,
      [schoolId, guardianId],
    );
    return rows.map((row) => row.studentId);
  }
}
