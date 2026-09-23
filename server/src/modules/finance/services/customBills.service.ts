import { AppError } from '../../../shared/errors/AppError';
import type { Paginated } from '../../../shared/response/apiResponse';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { WebsiteService } from '../../school/services/website.service';
import {
  WhatsAppShareService,
  type WhatsAppShare,
} from '../../../shared/services/whatsappShare.service';
import { buildCustomBillPdf } from '../../../shared/utils/financePdf';
import { DocumentDeliveriesService } from './documentDeliveries.service';
import { CustomBillRepository } from '../repositories/customBill.repository';
import { PaymentDestinationRepository } from '../repositories/paymentDestination.repository';
import type { CustomBillDTO } from '../dto/finance.dto';
import type {
  CreateCustomBillInput,
  FetchCustomBillsQuery,
  UpdateCustomBillInput,
} from '../validators/customBills.schema';

const MONEY_SCALE = 100;

/**
 * A one-off bill for whoever a school needs to invoice outside its own
 * enrolled students (spec section 26 does not apply here — see `CustomBill`).
 *
 * `total` is never trusted from the request: it is always the sum of the
 * lines actually sent, computed here, the same discipline `InvoicesService`
 * already holds for a real bill's totals.
 */
export class CustomBillsService {
  static Instance = new CustomBillsService();

  private constructor(
    private readonly bills = CustomBillRepository.Instance,
    private readonly destinations = PaymentDestinationRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly websites = WebsiteService.Instance,
    private readonly audit = AuditService.Instance,
    private readonly sharing = WhatsAppShareService.Instance,
    private readonly deliveries = DocumentDeliveriesService.Instance,
  ) {}

  async fetchAll(
    context: RequestContext,
    query: FetchCustomBillsQuery,
  ): Promise<Paginated<CustomBillDTO>> {
    return this.bills.fetchPaginated(context.schoolId, query);
  }

  /**
   * One bill on its own — the printable copy reads this rather than
   * filtering the list already in memory, for the same reason
   * `FeeStructuresService.fetchOne` does. Also where the letterhead is
   * attached, the same way as there and `InvoicesService.fetchInvoice`.
   */
  async fetchOne(context: RequestContext, id: string): Promise<CustomBillDTO> {
    const dto = await this.bills.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Bill');

    const [school, website] = await Promise.all([
      this.schools.findById(context.schoolId),
      this.websites.getForSchool(context.schoolId),
    ]);
    if (!school) throw AppError.internal();

    return {
      ...dto,
      schoolName: school.name,
      schoolLogoUrl: school.branding?.logoUrl ?? null,
      schoolPhone: website.contactPhone || school.phone,
      schoolEmail: website.contactEmail || school.email,
    };
  }

  /**
   * Stores this bill's PDF and hands back a WhatsApp message carrying its link,
   * addressed to whoever the bill is made out to.
   *
   * A custom bill has no student and so no guardian to look a number up on: the
   * sender picks the chat in WhatsApp themselves.
   */
  async shareOnWhatsApp(context: RequestContext, id: string): Promise<WhatsAppShare> {
    const bill = await this.fetchOne(context, id);
    const schoolName = bill.schoolName ?? context.membership.schoolName;

    const pdf = await buildCustomBillPdf({
      schoolName,
      schoolLogoUrl: bill.schoolLogoUrl,
      schoolPhone: bill.schoolPhone,
      schoolEmail: bill.schoolEmail,
      payerName: bill.payerName,
      createdAt: bill.createdAt,
      lines: bill.lines,
      total: bill.total,
      note: bill.note,
      accounts: bill.accounts,
    });

    const share = await this.sharing.shareDocument({
      kind: 'bill',
      pdf,
      // Not the payer's name: it would sit in a public address.
      name: `bill-${bill.id.slice(0, 8)}`,
      greeting: bill.payerName,
      subject: 'your bill',
      confidential: true,
      schoolName,
      contactEmail: bill.schoolEmail,
    });

    // `PREPARED`, like every WhatsApp share: the message is written here, but
    // sending it is a person pressing Send. A custom bill belongs to no student,
    // so the register names only the payer it is made out to.
    await this.deliveries.log(
      context,
      { type: 'BILL', id: bill.id, label: bill.payerName },
      {
        channel: 'WHATSAPP',
        status: 'PREPARED',
        recipientName: bill.payerName,
        note: 'WhatsApp asked the sender to choose the chat.',
      },
    );

    await this.audit.record(context, {
      action: 'customBill.whatsappShared',
      entityType: 'CustomBill',
      entityId: bill.id,
      entityLabel: bill.payerName,
    });

    return share;
  }

  async create(context: RequestContext, input: CreateCustomBillInput): Promise<CustomBillDTO> {
    const paymentDestinationIds = input.paymentDestinationIds ?? [];
    await this.assertDestinationsExist(context.schoolId, paymentDestinationIds);

    const created = await this.bills.create({
      schoolId: context.schoolId,
      payerName: input.payerName,
      lines: input.lines,
      total: totalOf(input.lines),
      note: input.note ? input.note : null,
      paymentDestinationIds,
      createdByUserId: context.user.id,
    });

    await this.audit.record(context, {
      action: 'customBill.created',
      entityType: 'CustomBill',
      entityId: created.id,
      entityLabel: input.payerName,
      after: { lines: input.lines.length, total: created.total },
    });

    return this.requireDTO(context.schoolId, created.id);
  }

  async update(
    context: RequestContext,
    id: string,
    patch: UpdateCustomBillInput,
  ): Promise<CustomBillDTO> {
    const existing = await this.bills.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Bill');

    if (patch.paymentDestinationIds !== undefined) {
      await this.assertDestinationsExist(context.schoolId, patch.paymentDestinationIds);
    }

    await this.bills.update(id, {
      payerName: patch.payerName,
      lines: patch.lines,
      total: patch.lines ? totalOf(patch.lines) : undefined,
      note: patch.note === undefined ? undefined : patch.note || null,
      paymentDestinationIds: patch.paymentDestinationIds,
    });

    await this.audit.record(context, {
      action: 'customBill.updated',
      entityType: 'CustomBill',
      entityId: id,
      entityLabel: patch.payerName ?? existing.payerName,
      after: { ...patch, lines: patch.lines?.length },
    });

    return this.requireDTO(context.schoolId, id);
  }

  /** Not real billing history, so nothing stops deleting one — unlike a fee structure. */
  async remove(context: RequestContext, id: string): Promise<void> {
    const existing = await this.bills.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Bill');

    await this.bills.delete(context.schoolId, id);

    await this.audit.record(context, {
      action: 'customBill.deleted',
      entityType: 'CustomBill',
      entityId: id,
      entityLabel: existing.payerName,
      before: { total: existing.total },
    });
  }

  private async assertDestinationsExist(schoolId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.destinations.countExisting(schoolId, ids);
    if (found !== ids.length) {
      throw AppError.badRequest('One or more payment accounts could not be found.');
    }
  }

  private async requireDTO(schoolId: string, id: string): Promise<CustomBillDTO> {
    const dto = await this.bills.findOneDTO(schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
  }
}

/** Summed in kobo, like every other money total in this module, then back to a fixed string. */
function totalOf(lines: { amount: number; quantity: number }[]): string {
  const kobo = lines.reduce(
    (sum, line) => sum + Math.round(line.amount * line.quantity * MONEY_SCALE),
    0,
  );
  return (kobo / MONEY_SCALE).toFixed(2);
}
