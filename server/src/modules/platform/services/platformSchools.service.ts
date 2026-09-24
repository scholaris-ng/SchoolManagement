import { AppError } from '../../../shared/errors/AppError';
import { env } from '../../../config/env';
import { AuditService } from '../../audit/services/audit.service';
import { describeAccess } from '../../school/services/schoolAccess';
import {
  PlatformSchoolsRepository,
  type PlatformSchoolRow,
} from '../repositories/platformSchools.repository';
import { SmsCreditRepository } from '../../messaging/repositories/smsCredit.repository';
import { SmsService } from '../../messaging/services/sms.service';
import { describeSmsProvider } from '../../../shared/sms/router';
import type { PlatformSchoolDTO, PlatformSmsStatusDTO, SchoolSmsCreditsDTO } from '../dto/platform.dto';

export interface SubscriptionAdmin {
  userId?: string;
  email: string;
  requestId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Deciding which schools may keep using the software.
 *
 * Every school starts on a 14-day trial (the column default — see the
 * `SchoolAccess` migration); once that lapses its people are locked out until
 * someone here activates it, for as many months as they choose. There is no
 * self-service payment behind this: a school that wants to continue asks, and an
 * administrator presses the button.
 */
export class PlatformSchoolsService {
  static Instance = new PlatformSchoolsService();

  private constructor(
    private readonly schools = PlatformSchoolsRepository.Instance,
    private readonly credits = SmsCreditRepository.Instance,
    private readonly sms = SmsService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async list(): Promise<PlatformSchoolDTO[]> {
    const rows = await this.schools.findAll();
    const now = new Date();
    return rows.map((row) => toDTO(row, now));
  }

  /**
   * Activates a school for `months` more months.
   *
   * The entry goes into the *school's* own audit trail, not the administrator's:
   * it is that school's staff who will ask why they were let back in, and the
   * administrator may not belong to it at all.
   */
  async activate(
    admin: SubscriptionAdmin,
    schoolId: string,
    months = 1,
  ): Promise<PlatformSchoolDTO> {
    const row = await this.schools.extendAccess(schoolId, admin.email, months);
    if (!row) throw AppError.notFound('School');

    await this.audit.recordSystem(schoolId, {
      action: 'school.activated',
      entityType: 'School',
      entityId: schoolId,
      entityLabel: row.name,
      before: { accessEndsAt: row.previousEndsAt.toISOString() },
      after: { accessEndsAt: row.accessEndsAt.toISOString(), monthsAdded: months },
      actorName: admin.email,
      actorRole: 'Platform administrator',
      requestId: admin.requestId,
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return toDTO(row, new Date());
  }

  /** The gateway account's balance next to what schools have been promised. */
  async smsStatus(): Promise<PlatformSmsStatusDTO> {
    const provider = describeSmsProvider();
    const [promisedCredits, gateway] = await Promise.all([
      this.schools.totalSmsCredits(),
      provider.configured ? this.sms.balance() : Promise.resolve({ balance: null, error: null }),
    ]);
    return {
      ...provider,
      unitPriceNgn: env.sms.unitPriceNgn,
      gatewayBalance: gateway.balance,
      gatewayError: gateway.error,
      promisedCredits,
    };
  }

  async smsCredits(schoolId: string): Promise<SchoolSmsCreditsDTO> {
    const row = await this.schools.findOne(schoolId);
    if (!row) throw AppError.notFound('School');
    const entries = await this.credits.history(schoolId);
    return {
      schoolId,
      schoolName: row.name,
      balance: Number(row.smsCredits),
      unitPriceNgn: env.sms.unitPriceNgn,
      remainderNgn: Number(row.smsCreditRemainderNgn),
      entries,
    };
  }

  /**
   * Adds prepaid SMS credit to a school, once the platform has been paid for it
   * — there is no self-service purchase, same as activation. The entry goes
   * into the school's own audit trail, where its bursar will look for it.
   */
  async topUpSmsCredits(
    admin: SubscriptionAdmin,
    schoolId: string,
    amountNgn: number,
    note: string | null,
  ): Promise<SchoolSmsCreditsDTO & { unitsAdded: number }> {
    const row = await this.schools.findOne(schoolId);
    if (!row) throw AppError.notFound('School');

    const unitPriceNgn = env.sms.unitPriceNgn;
    if (amountNgn < unitPriceNgn) {
      throw AppError.badRequest(
        `₦${amountNgn.toLocaleString()} does not buy a single SMS at ₦${unitPriceNgn} each.`,
      );
    }

    const result = await this.credits.topUp(schoolId, amountNgn, unitPriceNgn, note, {
      userId: admin.userId ?? null,
      name: admin.email,
    });
    if (result === null) throw AppError.notFound('School');
    const { balance, unitsAdded } = result;

    await this.audit.recordSystem(schoolId, {
      action: 'school.sms_credits_added',
      entityType: 'School',
      entityId: schoolId,
      entityLabel: row.name,
      before: { smsCredits: Number(row.smsCredits) },
      after: { smsCredits: balance, unitsAdded, amountNgn, unitPriceNgn, note },
      actorName: admin.email,
      actorRole: 'Platform administrator',
      requestId: admin.requestId,
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return { ...(await this.smsCredits(schoolId)), unitsAdded };
  }
}

function toDTO(row: PlatformSchoolRow, now: Date): PlatformSchoolDTO {
  const access = describeAccess(
    { status: row.status, accessEndsAt: row.accessEndsAt },
    env.subscription.contactEmail,
    now,
  );
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    slug: row.slug,
    email: row.email,
    phone: row.phone,
    plan: access.plan,
    endsAt: access.endsAt,
    expired: access.expired,
    daysLeft: access.daysLeft,
    lastActivatedAt: row.lastActivatedAt ? new Date(row.lastActivatedAt).toISOString() : null,
    lastActivatedBy: row.lastActivatedBy,
    smsCredits: Number(row.smsCredits ?? 0),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
