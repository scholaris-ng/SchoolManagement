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

  /**
   * A platform administrator's top-up: money in, whole pages out. A top-up
   * rarely divides evenly by the unit price, so the leftover naira is banked
   * on the school (`sms_credit_remainder_ngn`) and folded into the *next*
   * top-up instead of being discarded — two ₦100 top-ups at ₦8/page credit
   * 12 pages each (₦96) if done independently, losing ₦4 every time, but 25
   * pages between them once the first top-up's ₦4 carries into the second.
   *
   * The remainder is read and written inside the same transaction as the
   * balance update (with `FOR UPDATE`), so two top-ups racing on one school
   * can't both read the same leftover and double-bank it.
   */
  async topUp(
    schoolId: string,
    amountNgn: number,
    unitPriceNgn: number,
    note: string | null,
    actor: Actor,
  ): Promise<{ balance: number; unitsAdded: number } | null> {
    return AppDataSource.transaction(async (manager) => {
      const [school]: { remainder: string }[] = await manager.query(
        `SELECT sms_credit_remainder_ngn AS remainder
           FROM schools
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE`,
        [schoolId],
      );
      if (!school) return null;

      const total = Number(school.remainder) + amountNgn;
      const units = Math.floor(total / unitPriceNgn);
      const remainderAfter = Math.round((total - units * unitPriceNgn) * 100) / 100;

      const [row]: { balance: number }[] = await manager.query(
        `UPDATE schools
            SET sms_credits = sms_credits + $2,
                sms_credit_remainder_ngn = $3,
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING sms_credits AS balance`,
        [schoolId, units, remainderAfter],
      );
      const balance = row?.balance;
      if (balance === undefined) return null;

      await manager.query(
        `INSERT INTO sms_credit_entries
           (school_id, type, units, balance_after, note, actor_user_id, actor_name,
            amount_ngn, unit_price_ngn)
         VALUES ($1, 'TOPUP', $2, $3, $4, $5, $6, $7, $8)`,
        [schoolId, units, balance, note, actor.userId, actor.name, amountNgn, unitPriceNgn],
      );

      return { balance: Number(balance), unitsAdded: units };
    });
  }

  /**
   * A platform administrator's manual correction, in whole pages either
   * direction. Money-based top-ups go through `topUp` instead, so the
   * remainder-carrying logic there can't be bypassed.
   */
  async adjust(
    schoolId: string,
    units: number,
    note: string | null,
    actor: Actor,
  ): Promise<number | null> {
    return this.move(schoolId, units, 'ADJUSTMENT', {
      note,
      smsMessageId: null,
      actor,
      paid: null,
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
