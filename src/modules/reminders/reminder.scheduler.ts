import cron, { type ScheduledTask } from 'node-cron';
import type { Logger } from 'pino';
import type { ReminderService } from './reminder.service.js';
export class ReminderScheduler {
  private task?: ScheduledTask;
  constructor(
    private readonly expression: string,
    private readonly service: ReminderService,
    private readonly logger: Logger,
  ) {}
  start() {
    this.task = cron.schedule(this.expression, () => {
      void this.service
        .run()
        .catch((error: unknown) => this.logger.error({ err: error }, 'Reminder job failed'));
    });
    this.logger.info('🕒 Reminder scheduler started');
  }
  async stop() {
    await this.task?.stop();
  }
}
