import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { PaymentDestinationRepository } from '../repositories/paymentDestination.repository';
import type { PaymentDestinationDTO, PaymentDestinationDuplicateGroupDTO } from '../dto/finance.dto';
import type {
  CreatePaymentDestinationInput,
  MergePaymentDestinationsInput,
  UpdatePaymentDestinationInput,
} from '../validators/paymentDestinations.schema';

/**
 * The school's own bank accounts, managed once in one place.
 *
 * A fee item, a fee structure line, or a custom bill each pick from this list
 * by id rather than owning a copy of the details — see `PaymentDestination`.
 * Deleting or editing one here is instant everywhere it is picked; a bill
 * already issued is unaffected, because `InvoiceLine` snapshotted the details
 * it was raised under at the time.
 */
export class PaymentDestinationsService {
  static Instance = new PaymentDestinationsService();

  private constructor(
    private readonly destinations = PaymentDestinationRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /** Small enough a school reads its whole list at once, like discounts. */
  async fetchAll(context: RequestContext): Promise<PaymentDestinationDTO[]> {
    return this.destinations.fetchForSchool(context.schoolId);
  }

  /** Groups of accounts that look like the same real account, for the "merge" screen. */
  async fetchDuplicates(context: RequestContext): Promise<PaymentDestinationDuplicateGroupDTO[]> {
    const groups = await this.destinations.findDuplicateGroups(context.schoolId);
    return groups.map((destinations) => ({
      bankName: destinations[0].bankName,
      accountNumber: destinations[0].accountNumber,
      destinations,
    }));
  }

  /**
   * No database constraint stops two rows describing the same real account
   * (see `PaymentDestination`'s doc comment for why), so this is the one
   * place uniqueness is actually enforced — against *new* duplicates only.
   */
  async create(
    context: RequestContext,
    input: CreatePaymentDestinationInput,
  ): Promise<PaymentDestinationDTO> {
    const clash = await this.destinations.findMatch(
      context.schoolId,
      input.bankName,
      input.accountNumber,
    );
    if (clash) {
      throw AppError.conflict('An account with that bank and number is already saved.');
    }

    const created = await this.destinations.create({
      schoolId: context.schoolId,
      label: input.label ?? null,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      sortOrder: input.sortOrder,
    });

    await this.audit.record(context, {
      action: 'paymentDestination.created',
      entityType: 'PaymentDestination',
      entityId: created.id,
      entityLabel: `${created.bankName} · ${created.accountNumber}`,
      after: { bankName: created.bankName, accountNumber: created.accountNumber },
    });

    return this.requireDTO(context.schoolId, created.id);
  }

  async update(
    context: RequestContext,
    id: string,
    patch: UpdatePaymentDestinationInput,
  ): Promise<PaymentDestinationDTO> {
    const existing = await this.destinations.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Payment account');

    const bankName = patch.bankName ?? existing.bankName;
    const accountNumber = patch.accountNumber ?? existing.accountNumber;
    if (patch.bankName || patch.accountNumber) {
      const clash = await this.destinations.findMatch(context.schoolId, bankName, accountNumber);
      if (clash && clash.id !== id) {
        throw AppError.conflict('An account with that bank and number is already saved.');
      }
    }

    await this.destinations.update(id, patch);

    await this.audit.record(context, {
      action: 'paymentDestination.updated',
      entityType: 'PaymentDestination',
      entityId: id,
      entityLabel: `${bankName} · ${accountNumber}`,
      after: patch,
    });

    return this.requireDTO(context.schoolId, id);
  }

  /**
   * Nothing here checks whether a fee item, structure line or custom bill
   * still points at this id — the same as an account edited out from under
   * them. Whatever picked it simply resolves one account shorter afterwards,
   * exactly like an id that goes stale for any other reason (see
   * `PaymentDestinationRepository.resolveMany`).
   */
  async remove(context: RequestContext, id: string): Promise<void> {
    const existing = await this.destinations.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Payment account');

    await this.destinations.remove(context.schoolId, id);

    await this.audit.record(context, {
      action: 'paymentDestination.deleted',
      entityType: 'PaymentDestination',
      entityId: id,
      entityLabel: `${existing.bankName} · ${existing.accountNumber}`,
      before: { bankName: existing.bankName, accountNumber: existing.accountNumber },
      severity: 'WARNING',
    });
  }

  /**
   * Folds a group of duplicate accounts into one survivor — see
   * `PaymentDestinationRepository.merge`. Everything that pointed at one of
   * `mergeIds` is repointed to `keepId` before the duplicate rows are
   * deleted, so nothing ends up referencing a row that no longer exists.
   */
  async merge(context: RequestContext, input: MergePaymentDestinationsInput): Promise<void> {
    const ids = [input.keepId, ...input.mergeIds];
    const found = await this.destinations.countExisting(context.schoolId, ids);
    if (found !== ids.length) throw AppError.notFound('Payment account');

    const survivor = await this.requireDTO(context.schoolId, input.keepId);

    await this.destinations.merge(context.schoolId, input.keepId, input.mergeIds);

    await this.audit.record(context, {
      action: 'paymentDestination.merged',
      entityType: 'PaymentDestination',
      entityId: input.keepId,
      entityLabel: `${survivor.bankName} · ${survivor.accountNumber}`,
      after: { mergedIds: input.mergeIds },
      severity: 'WARNING',
    });
  }

  private async requireDTO(schoolId: string, id: string): Promise<PaymentDestinationDTO> {
    const dto = await this.destinations.findOneDTO(schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
  }
}
