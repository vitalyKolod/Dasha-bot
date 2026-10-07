import type { Bot } from 'grammy';
import type { BotContext } from '../../bot/context.js';
import type { Logger } from 'pino';
import { UserRepository } from '../users/user.repository.js';
import { sleep } from '../../shared/utils/sleep.js';
export class BroadcastService {
  constructor(
    private readonly bot: Bot<BotContext>,
    private readonly logger: Logger,
    private readonly users = new UserRepository(),
  ) {}
  async send(fromChatId: number, messageId: number) {
    let total = 0,
      sent = 0,
      failed = 0,
      blocked = 0;
    for await (const user of this.users.listAll()) {
      total += 1;
      try {
        await this.bot.api.copyMessage(Number(user.telegramId), fromChatId, messageId);
        sent += 1;
      } catch (error) {
        failed += 1;
        const text = error instanceof Error ? error.message : String(error);
        if (text.includes('403')) {
          blocked += 1;
          await this.users.markBlocked(user.telegramId);
        }
      }
      await sleep(40);
    }
    this.logger.info({ total, sent, failed, blocked }, '📢 BROADCAST COMPLETED');
    return { total, sent, failed, blocked };
  }
}
