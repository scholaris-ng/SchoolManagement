import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { SessionRepository } from '../../academics/repositories/session.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { DiscountRepository } from '../repositories/discount.repository';
import { StudentDiscountRepository } from '../repositories/studentDiscount.repository';
import type { StudentDiscountDTO } from '../dto/finance.dto';
import type { GrantStudentDiscountInput } from '../validators/studentDiscounts.schema';

/**
 * Who is entitled to which discount (spec section 26).
 *
 * Granting one changes no money by itself: it is picked up the next time a
 * bill is raised for the student — by hand or in a bulk run — and the amount
 * it took is then snapshotted on that invoice. An invoice already issued is
 * left exactly as it was; re-billing a family is a decision, not a side
 * effect of ticking a box.
 */
export class StudentDiscountsService {
  static Instance = new StudentDiscountsService();

  private constructor(
    private readonly grants = StudentDiscountRepository.Instance,
    private readonly discounts = DiscountRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly sessions = SessionRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchForStudent(context: RequestContext, studentId: string): Promise<StudentDiscountDTO[]> {
    // 404, not 403 — same as the ledger: that a child has a concession is not
    // something an unrelated family gets to confirm.
    if (!(await this.access.canSeeStudent(context, studentId))) {
      throw AppError.notFound('Student');
    }
    return this.grants.fetchActiveForStudent(context.schoolId, studentId);
  }

  async grant(
    context: RequestContext,
    studentId: string,
    input: GrantStudentDiscountInput,
  ): Promise<StudentDiscountDTO> {
    const student = await this.students.findOneDTO(context.schoolId, studentId);
    if (!student) throw AppError.notFound('Student');

    const discount = await this.discounts.findOneDTO(context.schoolId, input.discountId);
    if (!discount) throw AppError.notFound('Discount');
    if (!discount.isActive) {
      throw AppError.validation('That discount is switched off. Turn it on before granting it.');
    }

    let sessionId = input.sessionId ?? null;
    const termId = input.termId ?? null;

    if (termId) {
      const term = await this.terms.findOneDTO(context.schoolId, termId);
      if (!term) throw AppError.notFound('Term');
      if (sessionId && sessionId !== term.sessionId) {
        throw AppError.validation('That term belongs to a different session.');
      }
      sessionId = term.sessionId;
    } else if (sessionId) {
      const session = await this.sessions.findOneDTO(context.schoolId, sessionId);
      if (!session) throw AppError.notFound('Academic session');
    }

    const existing = await this.grants.findActiveMatch(
      context.schoolId,
      studentId,
      discount.id,
      sessionId,
      termId,
    );
    if (existing) {
      throw AppError.conflict(
        `${student.fullName} already has ${discount.name} for that period.`,
      );
    }

    const created = await this.grants.create({
      schoolId: context.schoolId,
      studentId,
      discountId: discount.id,
      sessionId,
      termId,
      note: input.note ? input.note : null,
      grantedByUserId: context.user.id,
    });

    await this.audit.record(context, {
      action: 'studentDiscount.granted',
      entityType: 'StudentDiscount',
      entityId: created.id,
      entityLabel: `${discount.name} · ${student.fullName}`,
      after: { discountId: discount.id, sessionId, termId },
    });

    return this.requireDTO(context.schoolId, created.id);
  }

  async revoke(context: RequestContext, studentId: string, grantId: string): Promise<void> {
    const existing = await this.grants.findEntity(context.schoolId, grantId);
    if (!existing || existing.studentId !== studentId) throw AppError.notFound('Discount grant');
    if (!existing.isActive) throw AppError.conflict('That discount has already been removed.');

    const dto = await this.requireDTO(context.schoolId, grantId);
    await this.grants.revoke(grantId, context.user.id);

    await this.audit.record(context, {
      action: 'studentDiscount.revoked',
      entityType: 'StudentDiscount',
      entityId: grantId,
      entityLabel: `${dto.discountName} · ${dto.studentName}`,
      severity: 'WARNING',
    });
  }

  private async requireDTO(schoolId: string, id: string): Promise<StudentDiscountDTO> {
    const dto = await this.grants.findOneDTO(schoolId, id);
    if (!dto) throw AppError.internal();
    return dto;
  }
}
