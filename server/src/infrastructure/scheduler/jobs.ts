import { BirthdayGreetingsService } from '../../modules/messaging/services/birthdayGreetings.service';
import { Scheduler } from './scheduler';

/**
 * Every job the API runs unprompted, in one place. Adding a scheduled task —
 * fee reminders, an end-of-day attendance digest — means adding an entry
 * here and nothing in `server.ts`.
 */
export function buildScheduler(): Scheduler {
  return new Scheduler().register({
    name: 'birthday-greetings',
    // Five minutes is the granularity of "send at 08:00": the run happens on
    // the first tick at or after the school's chosen time. Cheap when there is
    // nothing to do — one indexed query for the schools with the feature on.
    everyMs: 5 * 60_000,
    run: async (now) => {
      const summaries = await BirthdayGreetingsService.Instance.runDue(now);
      for (const summary of summaries) {
        if (summary.celebrants === 0) continue;
        console.info(
          `[birthdays] ${summary.date} school ${summary.schoolId}: ${summary.celebrants} celebrant(s), ` +
            `${summary.sent} sent, ${summary.alreadySent} already sent, ${summary.failed} failed, ` +
            `${summary.noRecipient} with no usable number.`,
        );
      }
    },
  });
}
