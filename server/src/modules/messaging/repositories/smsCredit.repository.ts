import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { SmsCreditEntry, type SmsCreditEntryType } from '../entities/smsCreditEntry.entity';

export interface SmsCreditEntryDTO {
  id: string;
  type: SmsCreditEntryType;
  units: number;
  balanceAfter: number;
  /** For a top-up: naira paid and the per-page price then; null for page-only movements. */
  amountNgn: number | null;
  unitPriceNgn: number | null;
  note: string | null;
  smsMessageId: string | null;
  actorName: string | null;
  createdAt: string;
}

const PROJECTION = `
  e.id, e.type, e.units, e.balance_after AS "balanceAfter",
  e.amount_ngn::float AS "amountNgn", e.unit_price_ngn::float AS "unitPriceNgn", e.note,
  e.sms_message_id AS "smsMessageId", e.actor_name AS "actorName",
  to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt"
`;

interface Actor {
  userId: string | null;
  name: string | null;
}

/**
 * A school's SMS credit: the balance on `schools.sms_credits`, and the ledger
 * behind it.
 *
 * Not a `TenantRepository`: a platform administrator moves credit on schools
 * that are not their own, and the send path moves it on behalf of a job with
 * no request at all. Every method still takes the school id first.
 *
 * Every movement is one statement that updates the balance and returns the
 * new figure, followed by the ledger row written *with that figure* — so two
 * concurrent debits can never both pass a check against the same old balance,
 * and the ledger's `balance_after` column is what the balance actually was.
 */
export class SmsCreditRepository {
  static Instance = new SmsCreditRepository();

  private readonly entries = AppDataSource.getRepository(SmsCreditEntry);

  private constructor() {}

  async balance(schoolId: string): Promise<number> {
    const [row] = await this.entries.query(`SELECT sms_credits AS balance FROM schools WHERE id = $1`, [schoolId]);
    return Number(row?.balance ?? 0);
  }

  /**
   * Takes `units` off the balance, or takes nothing and answers `null` when
   * there is not enough. The check and the decrement are one statement.
   */
  async debit(schoolId: string, units: number, smsMessageId: string): Promise<number | null> {
    return this.move(schoolId, -units, 'DEBIT', {
      note: null,
      smsMessageId,
      actor: { userId: null, name: 'System' },
      requireBalance: true,
    });
  }

  /** Gives a debit back — the gateway refused, so the page was never used. */
  async refund(schoolId: string, units: number, smsMessageId: string, note: string): Promise<number> {
    const balance = await this.move(schoolId, units, 'REFUND', {
      note,
      smsMessageId,
      actor: { userId: null, name: 'System' },
      requireBalance: false,
    });
    return balance ?? 0;
  }

  /** A platform administrator's top-up (positive) or correction (either sign). */
  async adjust(
    schoolId: string,
    units: number,
    type: Extract<SmsCreditEntryType, 'TOPUP' | 'ADJUSTMENT'>,
    note: string | null,
    actor: Actor,
    paid: { amountNgn: number; unitPriceNgn: number } | null = null,
  ): Promise<number | null> {
    return this.move(schoolId, units, type, {
      note,
      smsMessageId: null,
      actor,
      paid,
      // A negative correction must not push the school below zero.
      requireBalance: units < 0,
    });
  }

  async history(schoolId: string, limit = 50): Promise<SmsCreditEntryDTO[]> {
    return this.entries.query(
      `SELECT ${PROJECTION}
         FROM sms_credit_entries e
        WHERE e.school_id = $1
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT $2`,
      [schoolId, limit],
    );
  }

  private async move(
    schoolId: string,
    units: number,
    type: SmsCreditEntryType,
    options: {
      note: string | null;
      smsMessageId: string | null;
      actor: Actor;
      requireBalance: boolean;
      paid?: { amountNgn: number; unitPriceNgn: number } | null;
    },
  ): Promise<number | null> {
    return AppDataSource.transaction(async (manager) => {
      const rows: { balance: number }[] = await manager.query(
        `UPDATE schools
            SET sms_credits = sms_credits + $2, updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
            AND ($3::boolean IS FALSE OR sms_credits + $2 >= 0)
          RETURNING sms_credits AS balance`,
        [schoolId, units, options.requireBalance],
      );
      // `UPDATE … RETURNING` answers as [rows, affectedCount] under some drivers.
      const result = Array.isArray(rows[0]) ? (rows[0] as unknown as typeof rows) : rows;
      const balance = result[0]?.balance;
      if (balance === undefined) return null;

      await manager.query(
        `INSERT INTO sms_credit_entries
           (school_id, type, units, balance_after, note, sms_message_id, actor_user_id, actor_name,
            amount_ngn, unit_price_ngn)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          schoolId, type, units, balance, options.note, options.smsMessageId,
          options.actor.userId, options.actor.name,
          options.paid?.amountNgn ?? null, options.paid?.unitPriceNgn ?? null,
        ],
      );
      return Number(balance);
    });
  }
}
