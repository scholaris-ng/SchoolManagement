import { AppError } from '../../../shared/errors/AppError';
import type { Paginated } from '../../../shared/response/apiResponse';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { WebsiteService } from '../../school/services/website.service';
import { CustomBillRepository } from '../repositories/customBill.repository';
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
    private readonly schools = SchoolRepository.Instance,
    private readonly websites = WebsiteService.Instance,
    private readonly audit = AuditService.Instance,
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

  async create(context: RequestContext, input: CreateCustomBillInput): Promise<CustomBillDTO> {
    const created = await this.bills.create({
      schoolId: context.schoolId,
      payerName: input.payerName,
      lines: input.lines,
      total: totalOf(input.lines),
      note: input.note ? input.note : null,
      accounts: accountsOf(input.accounts),
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

    await this.bills.update(id, {
      payerName: patch.payerName,
      lines: patch.lines,
      total: patch.lines ? totalOf(patch.lines) : undefined,
      note: patch.note === undefined ? undefined : patch.note || null,
      accounts: patch.accounts === undefined ? undefined : accountsOf(patch.accounts),
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

  private async requireDTO(schoolId: string, id: string): Promise<CustomBillDTO> {
    const dto = await this.bills.findOneDTO(schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
  }
}

/** Summed in kobo, like every other money total in this module, then back to a fixed string. */
function totalOf(lines: { amount: number }[]): string {
  const kobo = lines.reduce((sum, line) => sum + Math.round(line.amount * MONEY_SCALE), 0);
  return (kobo / MONEY_SCALE).toFixed(2);
}

/** `label` is optional on the wire; the entity always carries one, `null` or not. */
function accountsOf(
  accounts: { label?: string | null; bankName: string; accountNumber: string; accountName: string }[] | undefined,
): { label: string | null; bankName: string; accountNumber: string; accountName: string }[] {
  return (accounts ?? []).map((account) => ({ ...account, label: account.label ?? null }));
}
