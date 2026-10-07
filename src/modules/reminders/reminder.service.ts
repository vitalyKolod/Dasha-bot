import { InlineKeyboard, type Bot } from 'grammy';
import type { Logger } from 'pino';
import { SubscriptionRepository } from '../subscriptions/subscription.repository.js';
import type { AccessService } from '../access/access.service.js';
import type { BotContext } from '../../bot/context.js';

export class ReminderService {
  constructor(
    private readonly bot: Bot<BotContext>,
    private readonly access: AccessService,
    private readonly logger: Logger,
    private readonly subscriptions = new SubscriptionRepository(),
  ) {}
  async run(now = new Date()): Promise<void> {
    await this.sendWindow(
      now,
      3,
      'reminder3DaysSentAt',
      '⏳ <b>Доступ скоро закончится</b>\n\nДо окончания доступа в клуб осталось 3 дня.\n\nПродли подписку, чтобы продолжить пользоваться всеми материалами 💛',
    );
    await this.sendWindow(
      now,
      1,
      'reminder1DaySentAt',
      '💛 <b>Напоминание</b>\n\nЗавтра заканчивается твой доступ в клуб.',
    );
    for (const candidate of await this.subscriptions.listDueForExpiration(now)) {
      const expired = await this.subscriptions.expireAtomically(String(candidate._id));
      if (!expired) continue;
      this.logger.info({ telegramId: expired.telegramId }, '🔒 SUBSCRIPTION EXPIRED');
      await this.access.removeFromClub(expired.telegramId);
      const claimed = await this.subscriptions.claimReminder(
        String(expired._id),
        'expirationNotificationSentAt',
      );
      if (claimed)
        await this.safeSend(
          expired.telegramId,
          '🔒 <b>Доступ завершён</b>\n\nСрок подписки закончился. После продления доступ автоматически вернётся.',
        );
    }
  }
  private async sendWindow(
    now: Date,
    days: number,
    field: 'reminder3DaysSentAt' | 'reminder1DaySentAt',
    text: string,
  ) {
    const from = now;
    const to = new Date(now.getTime() + days * 86_400_000);
    for (const item of await this.subscriptions.listActiveExpiringBetween(from, to)) {
      const claimed = await this.subscriptions.claimReminder(String(item._id), field);
      if (claimed) {
        await this.safeSend(item.telegramId, text);
        this.logger.info({ type: `${days}_days`, telegramId: item.telegramId }, '⏰ REMINDER SENT');
      }
    }
  }
  private async safeSend(telegramId: string, text: string) {
    try {
      await this.bot.api.sendMessage(Number(telegramId), text, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('💳 Продлить доступ', 'products'),
      });
    } catch (error) {
      this.logger.warn({ err: error, telegramId }, 'Reminder delivery failed');
    }
  }
}
