import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { chooseRecipient } from '../../../shared/utils/whatsapp';
import { localClock } from '../../../shared/utils/timezone';
import type { RequestContext } from '../../../shared/types/context';
import type { School } from '../../school/entities/school.entity';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { StudentRepository, type BirthdayCelebrant } from '../../students/repositories/student.repository';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import type { BirthdayRunSummaryDTO } from '../dto/messaging.dto';
import { renderTemplate } from './smsTemplate';
import { SmsService } from './sms.service';

/** When a school that never chose a time gets its messages. */
export const DEFAULT_BIRTHDAY_SMS_SEND_TIME = '08:00';

/**
 * The wording a school gets until it writes its own. Addressed to the child,
 * even though the phone belongs to a parent: that is who the message is for,
 * and the parent reads it out. Plain GSM characters only, so it stays one page.
 */
export const DEFAULT_BIRTHDAY_SMS_TEMPLATE =
  'Happy birthday, {firstName}! Everyone at {schoolName} wishes you a wonderful day and a great year ahead.';

/** The placeholders a template may use, documented for the settings screen. */
export const BIRTHDAY_TEMPLATE_PLACEHOLDERS = [
  'firstName',
  'fullName',
  'age',
  'className',
  'guardianName',
  'schoolName',
  'schoolShortName',
] as const;

const PURPOSE = 'STUDENT_BIRTHDAY';

/**
 * "EBUNOLUWA" → "Ebunoluwa". Imported registers often arrive in capitals, and
 * a greeting in capitals reads as shouting. Only an all-caps name is touched:
 * one typed with its own casing ("McDonald", "de Souza") is already right.
 */
function properCase(name: string): string {
  const trimmed = name.trim();
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, boundary: string, letter: string) => boundary + letter.toUpperCase());
}

/**
 * Texts every pupil celebrating a birthday today, once.
 *
 * Runs per school in the school's own timezone, and is safe to run as often
 * as anyone likes: every message carries a dedupe key of pupil + date, so the
 * scheduler firing after a restart, or an administrator pressing "send now"
 * after the morning run, greets nobody twice.
 */
export class BirthdayGreetingsService {
  static Instance = new BirthdayGreetingsService();

  /**
   * Which schools were already handled today, by school-local date. Only an
   * optimisation — the dedupe key is what actually prevents a repeat — so it
   * losing everything on restart costs one extra query per school, not a
   * duplicate message.
   */
  private readonly ranOn = new Map<string, string>();

  private constructor(
    private readonly sms = SmsService.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly guardians = GuardianRepository.Instance,
    private readonly audit = AuditService.Instance,
    private readonly notifications = NotificationsService.Instance,
  ) {}

  /**
   * The scheduler's entry point: every school whose send time has come and
   * that has not been handled yet today. Never throws — one school's failure
   * must not stop the rest being greeted.
   */
  async runDue(now = new Date()): Promise<BirthdayRunSummaryDTO[]> {
    if (!this.sms.isConfigured()) return [];

    let schools: School[];
    try {
      schools = await this.schools.findWithBirthdaySmsEnabled();
    } catch (error) {
      console.error('[birthdays] Could not list schools:', error);
      return [];
    }

    const summaries: BirthdayRunSummaryDTO[] = [];
    for (const school of schools) {
      const clock = localClock(now, school.settings.timezone);
      const sendTime = school.settings.birthdaySmsSendTime ?? DEFAULT_BIRTHDAY_SMS_SEND_TIME;
      // `HH:mm` strings compare correctly as text.
      if (clock.time < sendTime) continue;
      if (this.ranOn.get(school.id) === clock.date) continue;

      try {
        const summary = await this.runForSchool(school, now, null);
        this.ranOn.set(school.id, clock.date);
        summaries.push(summary);
      } catch (error) {
        console.error(`[birthdays] Run failed for school ${school.id}:`, error);
      }
    }
    return summaries;
  }

  /** The "send today's now" button. Ignores the send time; the dedupe key still applies. */
  async runNow(context: RequestContext): Promise<BirthdayRunSummaryDTO> {
    const school = await this.schools.findById(context.schoolId);
    if (!school) throw new Error('School not found');
    return this.runForSchool(school, new Date(), context);
  }

  private async runForSchool(
    school: School,
    now: Date,
    context: RequestContext | null,
  ): Promise<BirthdayRunSummaryDTO> {
    const clock = localClock(now, school.settings.timezone);
    const summary: BirthdayRunSummaryDTO = {
      schoolId: school.id,
      date: clock.date,
      celebrants: 0,
      sent: 0,
      failed: 0,
      alreadySent: 0,
      noRecipient: 0,
      noCredit: 0,
      creditsLeft: 0,
      skippedReason: null,
    };

    if (!this.sms.isConfigured()) {
      summary.skippedReason = 'SMS_NOT_CONFIGURED';
      return summary;
    }
    summary.creditsLeft = await this.sms.creditsFor(school.id);
    // A manual run on a school that has the feature off is still honoured —
    // the person pressing the button is choosing to send — but the scheduler
    // never reaches here for such a school.

    const celebrants = await this.students.findCelebrantsOn(school.id, clock);
    summary.celebrants = celebrants.length;
    if (celebrants.length === 0) return summary;

    const keyFor = (student: BirthdayCelebrant) => `student-birthday:${student.id}:${clock.date}`;
    const alreadySent = await this.sms.messagesAlreadySent(celebrants.map(keyFor));
    const pending = celebrants.filter((student) => !alreadySent.has(keyFor(student)));

    // Nothing to pay with: say so once, up front, rather than logging a
    // failure against every child and then saying so anyway. Only when
    // someone is actually waiting — a run repeated after everyone was greeted
    // (a restart, say) has nothing to complain about.
    if (summary.creditsLeft < 1 && pending.length > 0) {
      summary.skippedReason = 'NO_CREDIT';
      summary.alreadySent = celebrants.length - pending.length;
      summary.noCredit = pending.length;
      await this.record(school, summary, context);
      if (!context) await this.warnOutOfCredit(school, summary);
      return summary;
    }

    const contacts = await this.guardians.findContactsForStudents(
      school.id,
      pending.map((student) => student.id),
    );

    const template = school.settings.birthdaySmsTemplate?.trim() || DEFAULT_BIRTHDAY_SMS_TEMPLATE;

    let outOfCredit = false;
    for (const student of celebrants) {
      const key = keyFor(student);
      if (alreadySent.has(key)) {
        summary.alreadySent += 1;
        continue;
      }
      // The balance ran dry part way through: everyone still to come is
      // counted, not attempted, so they carry no failed row and are simply
      // sent on the next run once the school has been topped up.
      if (outOfCredit) {
        summary.noCredit += 1;
        continue;
      }

      const recipient = chooseRecipient(contacts.get(student.id) ?? []);
      if (!recipient.phone) {
        summary.noRecipient += 1;
        // Still logged, as a failure with the reason, so the office can see
        // whose record needs a number — a silent skip would look like the
        // feature simply did not run for that child.
        await this.sms.send({
          schoolId: school.id,
          purpose: PURPOSE,
          to: recipient.guardian?.phone ?? null,
          body: this.render(template, student, school, recipient.greeting, clock.year),
          recipientName: recipient.guardian ? recipient.greeting : null,
          studentId: student.id,
          guardianId: recipient.guardian?.id ?? null,
          dedupeKey: key,
          triggeredByUserId: context?.user.id ?? null,
        });
        continue;
      }

      const outcome = await this.sms.send({
        schoolId: school.id,
        purpose: PURPOSE,
        to: recipient.phone,
        body: this.render(template, student, school, recipient.greeting, clock.year),
        recipientName: recipient.greeting,
        studentId: student.id,
        guardianId: recipient.guardian?.id ?? null,
        dedupeKey: key,
        triggeredByUserId: context?.user.id ?? null,
      });
      if (outcome.status === 'SENT') {
        summary.sent += 1;
        summary.creditsLeft = outcome.creditsLeft;
      } else if (outcome.status === 'DUPLICATE') {
        summary.alreadySent += 1;
      } else if (outcome.failure === 'NO_CREDIT') {
        summary.noCredit += 1;
        outOfCredit = true;
      } else {
        summary.failed += 1;
      }
    }

    await this.record(school, summary, context);
    if (summary.noCredit > 0 && !context) await this.warnOutOfCredit(school, summary);
    return summary;
  }

  /**
   * Tells the people who run the school that credit has run out, on the
   * morning it bit. Only for the scheduled run: someone pressing "send now"
   * is looking at the result already. Once a day at most, since the scheduler
   * runs each school once a day.
   */
  private async warnOutOfCredit(school: School, summary: BirthdayRunSummaryDTO): Promise<void> {
    const missed = summary.noCredit;
    await this.notifications.notifySchoolAdmins(school.id, {
      category: 'SYSTEM',
      severity: 'WARNING',
      title: 'SMS credit has run out',
      body:
        `${missed} birthday message${missed === 1 ? ' was' : 's were'} not sent today because the school has no SMS credit left. ` +
        'Ask the platform administrator to top it up; anyone not yet greeted is sent once credit is added.',
      actionUrl: '/settings',
      entityType: 'School',
      entityId: school.id,
    });
  }

  private render(
    template: string,
    student: BirthdayCelebrant,
    school: School,
    guardianName: string,
    year: number,
  ): string {
    const fullName = [student.firstName, student.middleName, student.lastName]
      .filter((part) => part && part.trim())
      .map((part) => properCase(part!))
      .join(' ');
    return renderTemplate(template, {
      firstName: properCase(student.firstName),
      fullName,
      age: year - Number(student.dateOfBirth.slice(0, 4)),
      className: student.className ?? '',
      guardianName,
      schoolName: school.name,
      schoolShortName: school.shortName,
    });
  }

  /** One audit line per run that did something, so the day's sends are findable later. */
  private async record(
    school: School,
    summary: BirthdayRunSummaryDTO,
    context: RequestContext | null,
  ): Promise<void> {
    const event = {
      action: 'sms.birthday_greetings_sent',
      entityType: 'School',
      entityId: school.id,
      entityLabel: `${summary.date}: ${summary.sent} sent, ${summary.failed} failed`,
      after: { ...summary },
      severity: summary.failed > 0 ? ('WARNING' as const) : ('INFO' as const),
    };
    if (context) {
      await this.audit.record(context, event);
    } else {
      await this.audit.recordSystem(school.id, { ...event, actorName: 'Scheduler', actorRole: 'System' });
    }
  }
}
