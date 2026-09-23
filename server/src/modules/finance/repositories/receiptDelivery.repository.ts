import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { ReceiptDelivery } from '../entities/receiptDelivery.entity';
import type { ReceiptDeliveryDTO } from '../dto/finance.dto';

const PROJECTION = `
  rd.id, rd.payment_id AS "paymentId", rd.channel, rd.status,
  rd.recipient_name AS "recipientName", rd.recipient_contact AS "recipientContact",
  rd.guardian_id AS "guardianId",
  rd.include_charges AS "includeCharges",
  rd.note, rd.failure_reason AS "failureReason",
  rd.sent_by_name AS "sentByName", rd.sent_at AS "sentAt",
  rd.confirmed_by_name AS "confirmedByName", rd.confirmed_at AS "confirmedAt"
`;

export class ReceiptDeliveryRepository extends TenantRepository<ReceiptDelivery> {
  static Instance = new ReceiptDeliveryRepository();

  private constructor() {
    super(ReceiptDelivery, 'receiptDelivery');
  }

  async create(data: DeepPartial<ReceiptDelivery>): Promise<ReceiptDelivery> {
    return this.repo.save(this.repo.create(data));
  }

  async findEntity(schoolId: string, id: string): Promise<ReceiptDelivery | null> {
    return this.repo.findOne({ where: { schoolId, id } });
  }

  async findOneRow(schoolId: string, id: string): Promise<ReceiptDeliveryDTO | null> {
    const rows = await this.repo.query(
      `SELECT ${PROJECTION} FROM receipt_deliveries rd WHERE rd.school_id = $1 AND rd.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  /**
   * One receipt's whole delivery history, newest first — the whole list, not a
   * page of it: a receipt sent more than a handful of times is already
   * remarkable, and the office wants to see every one of them.
   */
  async findForPayment(schoolId: string, paymentId: string): Promise<ReceiptDeliveryDTO[]> {
    return this.repo.query(
      `SELECT ${PROJECTION}
         FROM receipt_deliveries rd
        WHERE rd.school_id = $1 AND rd.payment_id = $2
        ORDER BY rd.sent_at DESC`,
      [schoolId, paymentId],
    );
  }

  /**
   * Marks a `PREPARED` copy as one the family has. Conditional on the current
   * status, so two people confirming the same print do not overwrite each
   * other's name on it — and so a `FAILED` send can never be confirmed into
   * looking successful.
   */
  async confirm(
    schoolId: string,
    id: string,
    by: { userId: string; name: string },
  ): Promise<boolean> {
    const result = await this.repo.update(
      { schoolId, id, status: 'PREPARED' },
      {
        status: 'CONFIRMED',
        confirmedByUserId: by.userId,
        confirmedByName: by.name,
        confirmedAt: new Date(),
      },
    );
    return (result.affected ?? 0) > 0;
  }
}
