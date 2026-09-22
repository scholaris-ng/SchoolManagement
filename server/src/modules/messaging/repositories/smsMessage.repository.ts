import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { SmsMessage, type SmsPurpose, type SmsStatus } from '../entities/smsMessage.entity';
import type { SmsMessageDTO } from '../dto/messaging.dto';

const PROJECTION = `
  m.id, m.school_id AS "schoolId", m.purpose,
  m.recipient_phone AS "recipientPhone", m.recipient_name AS "recipientName",
  m.student_id AS "studentId",
  concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
  m.guardian_id AS "guardianId",
  m.body, m.status, m.provider, m.provider_message_id AS "providerMessageId",
  m.error_message AS "errorMessage",
  to_char(m.sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "sentAt",
  to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt"
`;

export interface SmsLogFilter {
  page: number;
  pageSize: number;
  purpose?: SmsPurpose;
  status?: SmsStatus;
  studentId?: string;
  search?: string;
}

export interface NewSmsMessage {
  schoolId: string;
  purpose: SmsPurpose;
  recipientPhone: string;
  recipientName: string | null;
  studentId: string | null;
  guardianId: string | null;
  body: string;
  dedupeKey: string | null;
  triggeredByUserId: string | null;
}

export class SmsMessageRepository extends TenantRepository<SmsMessage> {
  static Instance = new SmsMessageRepository();

  private constructor() {
    super(SmsMessage, 'sms');
  }

  /**
   * Writes the row that says "we are about to send this", and returns its id —
   * or `null` when the same `dedupeKey` was already sent (or is being sent
   * right now), which is the signal to send nothing. A key whose earlier
   * attempt *failed* is taken over instead, so fixing a guardian's number and
   * pressing "send now" retries it. The conflict is resolved by the database
   * rather than by a read-then-insert, so two runs racing each other cannot
   * both get through.
   */
  async claim(message: NewSmsMessage): Promise<string | null> {
    const rows: { id: string }[] = await this.repo.query(
      `INSERT INTO sms_messages
         (school_id, purpose, recipient_phone, recipient_name, student_id, guardian_id,
          body, status, dedupe_key, triggered_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'QUEUED', $8, $9)
       ON CONFLICT (dedupe_key) DO UPDATE
         SET status = 'QUEUED',
             recipient_phone = EXCLUDED.recipient_phone,
             recipient_name = EXCLUDED.recipient_name,
             guardian_id = EXCLUDED.guardian_id,
             body = EXCLUDED.body,
             provider = NULL, provider_message_id = NULL, provider_response = NULL,
             error_message = NULL,
             triggered_by_user_id = EXCLUDED.triggered_by_user_id,
             updated_at = now()
         WHERE sms_messages.status = 'FAILED'
       RETURNING id`,
      [
        message.schoolId,
        message.purpose,
        message.recipientPhone,
        message.recipientName,
        message.studentId,
        message.guardianId,
        message.body,
        message.dedupeKey,
        message.triggeredByUserId,
      ],
    );
    return rows[0]?.id ?? null;
  }

  async markSent(
    id: string,
    provider: string,
    providerMessageId: string | null,
    providerResponse: unknown,
  ): Promise<void> {
    await this.repo.query(
      `UPDATE sms_messages
          SET status = 'SENT', provider = $2, provider_message_id = $3,
              provider_response = $4, sent_at = now(), updated_at = now()
        WHERE id = $1`,
      [id, provider, providerMessageId, providerResponse === undefined ? null : JSON.stringify(providerResponse)],
    );
  }

  async markFailed(
    id: string,
    provider: string | null,
    errorMessage: string,
    providerResponse: unknown = null,
  ): Promise<void> {
    await this.repo.query(
      `UPDATE sms_messages
          SET status = 'FAILED', provider = $2, error_message = $3,
              provider_response = $4, updated_at = now()
        WHERE id = $1`,
      [id, provider, errorMessage, providerResponse === null ? null : JSON.stringify(providerResponse)],
    );
  }

  /**
   * Whether the message behind this key already went — so a run can tell
   * "greeted this morning" apart from "never tried" in its summary without
   * attempting an insert it knows will be refused.
   */
  async sentKeys(keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const rows: { key: string }[] = await this.repo.query(
      `SELECT dedupe_key AS key FROM sms_messages
        WHERE dedupe_key = ANY($1::text[]) AND status = 'SENT'`,
      [keys],
    );
    return new Set(rows.map((row) => row.key));
  }

  async findOneDTO(schoolId: string, id: string): Promise<SmsMessageDTO | null> {
    const rows: SmsMessageDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
         FROM sms_messages m LEFT JOIN students s ON s.id = m.student_id
        WHERE m.school_id = $1 AND m.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async fetchPaginated(schoolId: string, filter: SmsLogFilter): Promise<Paginated<SmsMessageDTO>> {
    const params: unknown[] = [schoolId];
    const where = ['m.school_id = $1'];

    if (filter.purpose) {
      params.push(filter.purpose);
      where.push(`m.purpose = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`m.status = $${params.length}`);
    }
    if (filter.studentId) {
      params.push(filter.studentId);
      where.push(`m.student_id = $${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(m.recipient_phone ILIKE $${i} OR m.recipient_name ILIKE $${i} OR m.body ILIKE $${i}
          OR concat_ws(' ', s.first_name, s.middle_name, s.last_name) ILIKE $${i})`,
      );
    }

    const whereSql = where.join(' AND ');
    const from = `FROM sms_messages m LEFT JOIN students s ON s.id = m.student_id`;

    const [countRow] = await this.repo.query(`SELECT COUNT(*)::int AS total ${from} WHERE ${whereSql}`, params);

    // Newest first, always — a delivery log read any other way is not a log.
    const rows: SmsMessageDTO[] = await this.repo.query(
      `SELECT ${PROJECTION} ${from}
       WHERE ${whereSql}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }
}
