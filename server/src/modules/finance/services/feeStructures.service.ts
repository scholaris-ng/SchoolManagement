import { In } from 'typeorm';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { SessionRepository } from '../../academics/repositories/session.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { LevelRepository } from '../../academics/repositories/level.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { FeeItemRepository } from '../repositories/feeItem.repository';
import {
  FeeStructureRepository,
  type FeeStructureLineDefinition,
} from '../repositories/feeStructure.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { WebsiteService } from '../../school/services/website.service';
import { InvoicesService, type IssueLine } from './invoices.service';
import type { FeeCategory } from '../entities/feeItem.entity';
import type { FeeStructureDTO, GenerateInvoicesResultDTO } from '../dto/finance.dto';
import type {
  CreateFeeStructureInput,
  FetchFeeStructuresQuery,
  GenerateInvoicesInput,
  UpdateFeeStructureInput,
} from '../validators/feeStructures.schema';

/**
 * One run must not be able to bill a whole federation in a single transaction.
 * Two thousand pupils is larger than any one Nigerian school's cohort and
 * small enough that the transaction finishes; a school past it bills by level.
 */
const MAX_PER_RUN = 2_000;

/**
 * The bundle of charges a term is billed from, and the one action that turns
 * it into invoices (spec section 26).
 *
 * A structure is a definition — nothing here says any family owes anything
 * until `generateInvoices` runs. That method is the point of the whole module:
 * a bursar who had to raise four hundred invoices one at a time would not use
 * the system, they would use a spreadsheet, and the ledger would be fiction.
 */
export class FeeStructuresService {
  static Instance = new FeeStructuresService();

  private constructor(
    private readonly structures = FeeStructureRepository.Instance,
    private readonly invoices = InvoiceRepository.Instance,
    private readonly invoicing = InvoicesService.Instance,
    private readonly feeItems = FeeItemRepository.Instance,
    private readonly sessions = SessionRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly levels = LevelRepository.Instance,
    private readonly classes = ClassRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly websites = WebsiteService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /* -- Reads ----------------------------------------------------------------- */

  async fetchAll(
    context: RequestContext,
    query: FetchFeeStructuresQuery,
  ): Promise<Paginated<FeeStructureDTO>> {
    return this.structures.fetchPaginated(context.schoolId, {
      ...query,
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
    });
  }

  /**
   * One structure on its own — the printable fee schedule reads this rather
   * than filtering the list already in memory, since a bursar sharing the
   * link (or reloading the print page) may not have that list loaded at all.
   * 404, not the 500 `requireDTO` gives internal callers: a bad or stale id
   * reaching this from the browser is an ordinary "not found", not a bug.
   */
  async fetchOne(context: RequestContext, id: string): Promise<FeeStructureDTO> {
    const dto = await this.structures.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Fee structure');

    // Letterhead details for the printable schedule — same reasoning as
    // `InvoicesService.fetchInvoice`: prefer the contact the school publishes
    // on its website settings, but fall back to the school's own record
    // rather than go blank when that has never been touched.
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

  /* -- Writes ---------------------------------------------------------------- */

  async create(
    context: RequestContext,
    input: CreateFeeStructureInput,
  ): Promise<FeeStructureDTO> {
    await this.assertScopeExists(context, input);
    const lines = await this.priceLines(context, input.lines);

    const created = await AppDataSource.transaction(async (manager) => {
      const structure = await this.structures.create(
        {
          schoolId: context.schoolId,
          name: input.name,
          sessionId: input.sessionId,
          termId: input.termId ?? null,
          levelIds: input.levelIds,
          classIds: input.classIds,
          isActive: input.isActive,
          createdByUserId: context.user.id,
        },
        manager,
      );
      await this.structures.replaceLines(context.schoolId, structure.id, lines, manager);
      return structure;
    });

    await this.audit.record(context, {
      action: 'feeStructure.created',
      entityType: 'FeeStructure',
      entityId: created.id,
      entityLabel: created.name,
      after: { sessionId: input.sessionId, termId: input.termId ?? null, lines: lines.length },
    });

    return this.requireDTO(context.schoolId, created.id);
  }

  /**
   * A patch that mentions `lines` replaces the whole set — see
   * `FeeStructureRepository.replaceLines` for why a structure's charges are one
   * decision rather than a list to edit row by row.
   */
  async update(
    context: RequestContext,
    id: string,
    patch: UpdateFeeStructureInput,
  ): Promise<FeeStructureDTO> {
    const existing = await this.structures.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Fee structure');

    await this.assertScopeExists(context, {
      sessionId: patch.sessionId ?? existing.sessionId,
      termId: patch.termId === undefined ? existing.termId : patch.termId,
      levelIds: patch.levelIds ?? existing.levelIds,
      classIds: patch.classIds ?? existing.classIds,
    });

    const lines = patch.lines ? await this.priceLines(context, patch.lines) : null;

    await AppDataSource.transaction(async (manager) => {
      await this.structures.update(
        id,
        {
          name: patch.name,
          sessionId: patch.sessionId,
          termId: patch.termId === undefined ? undefined : patch.termId,
          levelIds: patch.levelIds,
          classIds: patch.classIds,
          isActive: patch.isActive,
        },
        manager,
      );
      if (lines) await this.structures.replaceLines(context.schoolId, id, lines, manager);
    });

    await this.audit.record(context, {
      action: 'feeStructure.updated',
      entityType: 'FeeStructure',
      entityId: id,
      entityLabel: patch.name ?? existing.name,
      after: { ...patch, lines: lines?.length },
    });

    return this.requireDTO(context.schoolId, id);
  }

  /**
   * Refused once the structure has actually billed anyone: an issued invoice
   * points back to the structure it was raised from, and a bursar's later
   * question — "what was this bill built from?" — deserves a real answer.
   * `isActive` off is the tool for retiring one that has already been used;
   * this is for the ones created by mistake or never run.
   */
  async remove(context: RequestContext, id: string): Promise<void> {
    const existing = await this.structures.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Fee structure');

    if (await this.structures.hasInvoices(context.schoolId, id)) {
      throw AppError.conflict(
        'Invoices have already been generated from this structure, so deleting it would leave them pointing at nothing. Turn it off instead.',
      );
    }

    await this.structures.delete(context.schoolId, id);

    await this.audit.record(context, {
      action: 'feeStructure.deleted',
      entityType: 'FeeStructure',
      entityId: id,
      entityLabel: existing.name,
      before: { sessionId: existing.sessionId, termId: existing.termId },
      severity: 'WARNING',
    });
  }

  /* -- Billing the cohort ----------------------------------------------------- */

  /**
   * One invoice per pupil in scope who has not already been billed from this
   * structure for this term.
   *
   * The whole run is one transaction and takes the session's numbering lock
   * once, counting upward from what it returns — four hundred separate
   * `nextSequence` calls would serialise four hundred round trips behind one
   * advisory lock for no benefit.
   *
   * Pressing the button twice is safe and is not an error: the second run
   * reports everybody as skipped. `studentsToBill` filters them out, and the
   * partial unique index on `invoices` catches the narrower race where two
   * people press it at the same moment.
   */
  async generateInvoices(
    context: RequestContext,
    id: string,
    input: GenerateInvoicesInput,
  ): Promise<GenerateInvoicesResultDTO> {
    const structure = await this.structures.findOneDTO(context.schoolId, id);
    if (!structure) throw AppError.notFound('Fee structure');
    if (!structure.isActive) {
      throw AppError.validation('That fee structure is not active. Reactivate it first.');
    }

    if (structure.termId && input.termId && structure.termId !== input.termId) {
      throw AppError.validation(
        'That structure is written for one particular term, so it cannot bill another.',
      );
    }
    const termId = structure.termId ?? input.termId;
    if (!termId) {
      throw AppError.validation(
        'This structure applies to any term, so choose which term you are billing.',
      );
    }

    const term = await this.terms.findOneDTO(context.schoolId, termId);
    if (!term) throw AppError.notFound('Term');
    if (term.sessionId !== structure.sessionId) {
      throw AppError.validation('That term belongs to a different session from this structure.');
    }

    const definitions = await this.structures.lineDefinitions(context.schoolId, structure.id);
    if (definitions.length === 0) {
      throw AppError.validation('That structure has no charges on it yet.');
    }

    const alreadyBilled = await this.structures.countAlreadyBilled(
      context.schoolId,
      structure.id,
      termId,
    );
    const students = await this.structures.studentsToBill(
      context.schoolId,
      {
        id: structure.id,
        sessionId: structure.sessionId,
        levelIds: structure.levelIds,
        classIds: structure.classIds,
      },
      termId,
    );

    if (students.length > MAX_PER_RUN) {
      throw AppError.validation(
        `That would raise ${students.length} invoices at once. Narrow the structure to fewer levels or classes and run it again.`,
      );
    }

    let skipped = alreadyBilled;
    const invoiceIds: string[] = [];

    await AppDataSource.transaction(async (manager) => {
      const first = await this.invoices.nextSequence(manager, context.schoolId, structure.sessionId);

      for (const student of students) {
        const lines = linesFor(definitions, student.boardingStatus);
        if (lines.length === 0) {
          // Everything on the structure was an opt-in this pupil does not
          // take. An invoice with no charges is not a bill.
          skipped += 1;
          continue;
        }

        const invoice = await this.invoicing.issueInvoice(manager, {
          schoolId: context.schoolId,
          studentId: student.studentId,
          classId: student.classId,
          sessionId: structure.sessionId,
          sessionName: structure.sessionName,
          termId,
          sessionStartDate: term.sessionStartDate,
          termSequence: term.sequence,
          feeStructureId: structure.id,
          issueDate: todayIso(),
          dueDate: input.dueDate,
          sequence: first + invoiceIds.length,
          note: input.note ? input.note : null,
          lines,
          createdByUserId: context.user.id,
        });
        invoiceIds.push(invoice.id);
      }
    });

    await this.audit.record(context, {
      action: 'invoice.generated',
      entityType: 'FeeStructure',
      entityId: structure.id,
      entityLabel: `${structure.name} · ${term.name}`,
      after: { created: invoiceIds.length, skipped, termId, dueDate: input.dueDate },
    });

    return { created: invoiceIds.length, skipped, invoiceIds };
  }

  /* -- Shared ----------------------------------------------------------------- */

  /** Every id on the structure has to be a real row of this school's. */
  private async assertScopeExists(
    context: RequestContext,
    scope: {
      sessionId: string;
      termId?: string | null;
      levelIds: string[];
      classIds: string[];
    },
  ): Promise<void> {
    const session = await this.sessions.findOneDTO(context.schoolId, scope.sessionId);
    if (!session) throw AppError.notFound('Academic session');

    if (scope.termId) {
      const term = await this.terms.findOneDTO(context.schoolId, scope.termId);
      if (!term) throw AppError.notFound('Term');
      if (term.sessionId !== scope.sessionId) {
        throw AppError.validation('That term belongs to a different session.');
      }
    }

    if (scope.levelIds.length > 0) {
      const found = await this.levels.countScoped(context.schoolId, { id: In(scope.levelIds) });
      if (found !== scope.levelIds.length) {
        throw AppError.validation('One of those levels is not a level of this school.');
      }
    }

    if (scope.classIds.length > 0) {
      const found = await this.classes.countScoped(context.schoolId, { id: In(scope.classIds) });
      if (found !== scope.classIds.length) {
        throw AppError.validation('One of those classes is not a class of this school.');
      }
    }
  }

  /**
   * Fills in each line's amount and optionality from the fee item where the
   * request left them out, so a structure that just names its charges gets the
   * school's own prices rather than zeroes. `accountIds` is trusted from the
   * request but narrowed to ids that are actually accounts of that fee item —
   * a stale id, from an account deleted between page load and save, is
   * dropped rather than carried onto the structure.
   */
  private async priceLines(
    context: RequestContext,
    lines: { feeItemId: string; amount?: number; isOptional?: boolean; accountIds: string[] }[],
  ): Promise<{ feeItemId: string; amount: number; isOptional: boolean; accountIds: string[] }[]> {
    const items = await this.feeItems.fetchForSchool(context.schoolId);
    const byId = new Map(items.map((item) => [item.id, item]));

    return lines.map((line) => {
      const item = byId.get(line.feeItemId);
      if (!item) throw AppError.validation('One of those charges is not a fee item of this school.');
      const ownAccountIds = new Set(item.accounts.map((account) => account.id));
      return {
        feeItemId: item.id,
        amount: line.amount ?? item.amount,
        isOptional: line.isOptional ?? item.isOptional,
        accountIds: line.accountIds.filter((accountId) => ownAccountIds.has(accountId)),
      };
    });
  }

  private async requireDTO(schoolId: string, id: string): Promise<FeeStructureDTO> {
    const dto = await this.structures.findOneDTO(schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
  }
}

/**
 * Which of the structure's charges this particular pupil is billed.
 *
 * Boarding is the one opt-in the system can decide on its own, because the
 * pupil record says whether they board. Every other optional charge —
 * transport above all — is billed to everyone the structure covers, which is
 * wrong for a family that does not take the bus.
 *
 * Known gap, deliberately left: fixing it needs a per-student opt-in table
 * ("Amina takes the bus, Chidi does not"), and inventing a rule here instead
 * would guess at something only the office knows. Until that lands, a school
 * with a transport charge should leave it off the structure and invoice it by
 * hand.
 */
function linesFor(
  definitions: FeeStructureLineDefinition[],
  boardingStatus: 'DAY' | 'BOARDING',
): IssueLine[] {
  return definitions
    .filter((line) => !(line.isOptional && line.category === 'BOARDING' && boardingStatus === 'DAY'))
    .map((line) => ({
      feeItemId: line.feeItemId,
      description: line.name,
      category: line.category as FeeCategory,
      quantity: 1,
      unitAmount: line.amount,
      discountAmount: 0,
      isOptional: line.isOptional,
      accounts: line.accounts,
    }));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
