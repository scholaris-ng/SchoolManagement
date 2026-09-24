import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { School } from '../../school/entities/school.entity';

export interface PlatformSchoolRow {
  id: string;
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  accessEndsAt: Date;
  lastActivatedAt: Date | null;
  lastActivatedBy: string | null;
  smsCredits: number;
  smsCreditRemainderNgn: number;
  createdAt: Date;
}

const COLUMNS = `
  s.id, s.name, s.code, s.slug, s.email, s.phone, s.status,
  s.access_ends_at      AS "accessEndsAt",
  s.last_activated_at   AS "lastActivatedAt",
  s.last_activated_by   AS "lastActivatedBy",
  s.sms_credits         AS "smsCredits",
  s.sms_credit_remainder_ngn::float AS "smsCreditRemainderNgn",
  s.created_at          AS "createdAt"
`;

/**
 * Schools across the whole platform.
 *
 * Deliberately not a `TenantRepository`: the one place in the codebase that
 * reads every school's row rather than one's own, because deciding which school
 * to activate is the whole job of the screen it serves.
 */
export class PlatformSchoolsRepository {
  static Instance = new PlatformSchoolsRepository();

  private readonly repo = AppDataSource.getRepository(School);

  private constructor() {}

  /** Every school's unused SMS credit added up: what the platform still owes in messages. */
  async totalSmsCredits(): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(SUM(sms_credits), 0)::int AS total FROM schools WHERE deleted_at IS NULL`,
    );
    return Number(row?.total ?? 0);
  }

  /** Soonest to lapse first: what has already run out, then what is about to. */
  async findAll(): Promise<PlatformSchoolRow[]> {
    return this.repo.query(
      `SELECT ${COLUMNS}
         FROM schools s
        WHERE s.deleted_at IS NULL
        ORDER BY s.access_ends_at ASC, s.name ASC
        LIMIT 500`,
    );
  }

  async findOne(schoolId: string): Promise<PlatformSchoolRow | null> {
    const rows: PlatformSchoolRow[] = await this.repo.query(
      `SELECT ${COLUMNS} FROM schools s WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [schoolId],
    );
    return rows[0] ?? null;
  }

  /**
   * Adds `months` calendar months to the school's access and marks it activated
   * — in a single statement, so two administrators pressing the button at once
   * each add their time instead of both reading the same old date and one being
   * lost.
   *
   * The months are counted from the later of *now* and the current end date: a
   * school activated after it lapsed gets them from today, and one activated
   * with days left keeps those days. A `SUSPENDED` school stays suspended —
   * activation extends its access, and is not what lifts a suspension.
   *
   * `months` must already be a whole number in range; `make_interval` would
   * refuse a fraction, but the bounds are the caller's to enforce.
   *
   * `previousEndsAt` comes back too, for the audit trail.
   */
  async extendAccess(
    schoolId: string,
    activatedBy: string,
    months: number,
  ): Promise<(PlatformSchoolRow & { previousEndsAt: Date }) | null> {
    const rows: (PlatformSchoolRow & { previousEndsAt: Date })[] = await this.repo.query(
      `WITH prior AS (
         SELECT id, access_ends_at AS ends
           FROM schools
          WHERE id = $1 AND deleted_at IS NULL
            FOR UPDATE
       )
       UPDATE schools s
          SET access_ends_at    = GREATEST(s.access_ends_at, now()) + make_interval(months => $3::int),
              status            = CASE WHEN s.status = 'SUSPENDED' THEN s.status ELSE 'ACTIVE' END,
              last_activated_at = now(),
              last_activated_by = $2,
              updated_at        = now()
         FROM prior
        WHERE s.id = prior.id
        RETURNING ${COLUMNS}, prior.ends AS "previousEndsAt"`,
      [schoolId, activatedBy, months],
    );
    // `UPDATE … RETURNING` answers as [rows, affectedCount] under some drivers.
    const result = Array.isArray(rows[0]) ? (rows[0] as unknown as typeof rows) : rows;
    return result[0] ?? null;
  }
}
