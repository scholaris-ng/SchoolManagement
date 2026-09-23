import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { guardianGreeting } from '../../../shared/utils/whatsapp';
import { AuditService } from '../../audit/services/audit.service';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { ReceiptDeliveryRepository } from '../repositories/receiptDelivery.repository';
import type {
  ReceiptDeliveryChannel,
  ReceiptDeliveryStatus,
} from '../entities/receiptDelivery.entity';
import type { ReceiptDeliveryDTO } from '../dto/finance.dto';
import type {
  LogReceiptDeliveryInput,
  RecordReceiptDeliveryInput,
} from '../validators/receiptDeliveries.schema';

/** What the sending code — this module's own, or `PaymentsService` — knows about one copy going out. */
export interface ReceiptDeliveryEntry {
  channel: ReceiptDeliveryChannel;
  status: ReceiptDeliveryStatus;
  recipientName?: string | null;
  recipientContact?: string | null;
  guardianId?: string | null;
  includeCharges?: boolean;
  note?: string | null;
  failureReason?: string | null;
  sentAt?: Date;
}

/**
 * The register of receipts that have left the office (spec section 26).
 *
 * A receipt only does its job once the family holds it, and the three ways it
 * reaches them — paper over the counter, an email, a WhatsApp message — leave
 * no trace anywhere the office can work from. The audit log records the *act*
 * for security; this records the *delivery*, for the bursar with a parent on
 * the phone saying they never got it.
 *
 * Nothing here decides whether a copy arrived. `status` says only as much as is
 * actually known: an email the mailer accepted is `CONFIRMED`, a page sent to a
 * printer or a WhatsApp message handed to WhatsApp is `PREPARED` until a person
 * says otherwise, and a refused send is `FAILED`. A register that claimed more
 * than that would be worth less than no register at all.
 */
export class ReceiptDeliveriesService {
  static Instance = new ReceiptDeliveriesService();

  private constructor(
    private readonly deliveries = ReceiptDeliveryRepository.Instance,
    private readonly payments = PaymentRepository.Instance,
    private readonly guardians = GuardianRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchForPayment(context: RequestContext, paymentId: string): Promise<ReceiptDeliveryDTO[]> {
    await this.assertPayment(context, paymentId);
    return this.deliveries.findForPayment(context.schoolId, paymentId);
  }

  /**
   * Records a copy the office sent by its own means — paper handed across the
   * counter, a message from a staff member's own phone, a posted copy.
   *
   * These are `CONFIRMED` on a member of staff's word, which is the strongest
   * evidence there can be for a delivery this system never touched. Entries a
   * send makes for itself go through `log` instead.
   */
  async record(
    context: RequestContext,
    paymentId: string,
    input: RecordReceiptDeliveryInput,
  ): Promise<ReceiptDeliveryDTO> {
    const payment = await this.assertSendable(context, paymentId);

    const sentAt = input.sentAt ? new Date(input.sentAt) : new Date();
    if (Number.isNaN(sentAt.getTime())) throw AppError.validation('That date is not valid.');
    // A delivery is something that has happened. A date in the future would let
    // the register say a receipt is already out when it is not; a minute of
    // slack absorbs a desk clock that runs fast.
    if (sentAt.getTime() > Date.now() + 60_000) {
      throw AppError.validation('A receipt cannot have been sent in the future.');
    }

    let recipientName = input.recipientName?.trim() || null;
    let recipientContact = input.recipientContact?.trim() || null;

    // Naming a guardian is the usual case, and it fills in who it went to, so
    // nobody retypes an address that is already on file.
    if (input.guardianId) {
      if (!payment.studentId) {
        throw AppError.validation('This payment is not linked to a student record.');
      }
      const link = await this.guardians.findLinkByPair(
        context.schoolId,
        payment.studentId,
        input.guardianId,
      );
      if (!link) throw AppError.validation('That guardian is not linked to this student.');

      const guardian = await this.guardians.findByIdScoped(context.schoolId, input.guardianId);
      if (!guardian) throw AppError.notFound('Guardian');
      recipientName = recipientName ?? guardianGreeting(guardian);
      recipientContact =
        recipientContact ??
        (input.channel === 'EMAIL' ? guardian.email : guardian.phone ?? guardian.altPhone) ??
        null;
    }

    return this.write(context, paymentId, {
      channel: input.channel,
      status: 'CONFIRMED',
      recipientName,
      recipientContact,
      guardianId: input.guardianId ?? null,
      includeCharges: input.includeCharges,
      note: input.note?.trim() || null,
      sentAt,
    });
  }

  /**
   * A print the browser has just started.
   *
   * `PREPARED`, never confirmed: the print dialog belongs to the operating
   * system, so nothing here knows whether paper came out, let alone whether it
   * reached the family. Somebody at the desk confirms it, or it stands as what
   * it is — a receipt that was printed and may still be sitting on the tray.
   */
  async logPrint(
    context: RequestContext,
    paymentId: string,
    input: LogReceiptDeliveryInput,
  ): Promise<ReceiptDeliveryDTO> {
    await this.assertSendable(context, paymentId);
    return this.write(context, paymentId, {
      channel: 'PRINT',
      status: 'PREPARED',
      includeCharges: input.includeCharges,
      note: input.note?.trim() || null,
    });
  }

  /**
   * The entry a send makes for itself — an email the mailer took, or a message
   * handed to WhatsApp.
   *
   * Separate from `record` because the status is not the caller's to claim: it
   * follows from what the channel can actually prove. Callers inside this
   * server have already established that the payment exists, so — unlike
   * `record` — this does not look it up again.
   */
  async log(
    context: RequestContext,
    paymentId: string,
    entry: ReceiptDeliveryEntry,
  ): Promise<ReceiptDeliveryDTO> {
    return this.write(context, paymentId, entry);
  }

  /**
   * "Yes, the family has this" — the one thing a person can add that the system
   * cannot work out for itself: whether the paper was handed over, or Send was
   * actually pressed in WhatsApp.
   */
  async confirm(context: RequestContext, id: string): Promise<ReceiptDeliveryDTO> {
    const entity = await this.deliveries.findEntity(context.schoolId, id);
    if (!entity) throw AppError.notFound('Delivery record');
    if (entity.status === 'CONFIRMED') {
      throw AppError.conflict('This copy is already recorded as delivered.');
    }
    if (entity.status === 'FAILED') {
      throw AppError.validation(
        'That send failed, so it cannot be confirmed. Record the copy you sent instead.',
      );
    }

    const applied = await this.deliveries.confirm(context.schoolId, id, {
      userId: context.user.id,
      name: context.user.displayName,
    });
    if (!applied) throw AppError.conflict('This copy is already recorded as delivered.');

    await this.audit.record(context, {
      action: 'receipt.delivery.confirmed',
      entityType: 'ReceiptDelivery',
      entityId: id,
      entityLabel: `${entity.channel} · ${entity.recipientName ?? 'over the counter'}`,
      after: { status: 'CONFIRMED' },
    });

    const row = await this.deliveries.findOneRow(context.schoolId, id);
    if (!row) throw AppError.internal();
    return row;
  }

  /* -- Internals --------------------------------------------------------------- */

  private async write(
    context: RequestContext,
    paymentId: string,
    entry: ReceiptDeliveryEntry,
  ): Promise<ReceiptDeliveryDTO> {
    const created = await this.deliveries.create({
      schoolId: context.schoolId,
      paymentId,
      channel: entry.channel,
      status: entry.status,
      recipientName: entry.recipientName ?? null,
      recipientContact: entry.recipientContact ?? null,
      guardianId: entry.guardianId ?? null,
      includeCharges: entry.includeCharges ?? false,
      note: entry.note ?? null,
      failureReason: entry.failureReason ?? null,
      sentByUserId: context.user.id,
      sentByName: context.user.displayName,
      sentAt: entry.sentAt ?? new Date(),
    });

    await this.audit.record(context, {
      action: 'receipt.delivery.recorded',
      entityType: 'ReceiptDelivery',
      entityId: created.id,
      entityLabel: `${entry.channel} · ${entry.recipientName ?? 'over the counter'}`,
      after: { paymentId, channel: entry.channel, status: entry.status },
    });

    const row = await this.deliveries.findOneRow(context.schoolId, created.id);
    if (!row) throw AppError.internal();
    return row;
  }

  /** The receipt has to exist in this school before anything is logged against it. */
  private async assertPayment(context: RequestContext, paymentId: string) {
    const payment = await this.payments.findOneDTO(context.schoolId, paymentId);
    if (!payment) throw AppError.notFound('Receipt');
    return payment;
  }

  /**
   * The same bar `PaymentsService.emailReceipt` holds a send to: a reversed
   * payment's receipt is no longer proof of anything, so no *new* copy of it may
   * be recorded as having gone out. The copies already in the register stay
   * readable — they did go out, and a family holding one is exactly what the
   * office needs to know about.
   */
  private async assertSendable(context: RequestContext, paymentId: string) {
    const payment = await this.assertPayment(context, paymentId);
    if (payment.status !== 'SUCCESSFUL') {
      throw AppError.conflict('This payment was reversed, so its receipt can no longer be sent.');
    }
    return payment;
  }
}
