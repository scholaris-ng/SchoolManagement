/**
 * A job the API runs on its own clock, with nobody's request behind it.
 *
 * `run` is called every `everyMs` and once shortly after start-up (so a
 * restart at 08:03 still does the 08:00 work). It must be safe to call more
 * often than strictly needed — every job here decides for itself whether
 * there is anything to do *right now*, and does nothing twice. Overlapping
 * calls are prevented: a tick that arrives while the previous one is still
 * running is dropped, not queued.
 */
export interface ScheduledJob {
  name: string;
  everyMs: number;
  /** How long after `start()` the first tick fires. Default 30 s, so start-up finishes first. */
  initialDelayMs?: number;
  run: (now: Date) => Promise<void>;
}

interface Running {
  job: ScheduledJob;
  timer: NodeJS.Timeout | null;
  inFlight: boolean;
}

/**
 * In-process job runner. Deliberately small: `setInterval` per job, no
 * persistence, no clustering. Whether each piece of work already happened is
 * the job's own business (`sms_messages.dedupe_key`, say), which is what makes
 * a restart, or two ticks in a row, harmless.
 *
 * Runs on one instance only — see `SCHEDULER_ENABLED`. If this API is ever
 * scaled to several processes, either leave it on for exactly one of them or
 * move the jobs to an external cron hitting the equivalent HTTP routes.
 */
export class Scheduler {
  private readonly jobs: Running[] = [];
  private started = false;

  register(job: ScheduledJob): this {
    this.jobs.push({ job, timer: null, inFlight: false });
    return this;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    for (const entry of this.jobs) {
      const first = setTimeout(() => {
        void this.tick(entry);
        entry.timer = setInterval(() => void this.tick(entry), entry.job.everyMs);
        // A pending tick must never keep the process alive during shutdown.
        entry.timer.unref();
      }, entry.job.initialDelayMs ?? 30_000);
      first.unref();
      entry.timer = first;
    }
    console.info(`[scheduler] Running ${this.jobs.length} job(s): ${this.jobs.map((j) => j.job.name).join(', ')}.`);
  }

  stop(): void {
    for (const entry of this.jobs) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
    }
    this.started = false;
  }

  private async tick(entry: Running): Promise<void> {
    if (entry.inFlight) return;
    entry.inFlight = true;
    try {
      await entry.job.run(new Date());
    } catch (error) {
      console.error(`[scheduler] ${entry.job.name} failed:`, error);
    } finally {
      entry.inFlight = false;
    }
  }
}
