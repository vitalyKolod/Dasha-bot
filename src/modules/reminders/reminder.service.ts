import { InlineKeyboard, type Bot } from 'grammy';
import type { Logger } from 'pino';
import { SubscriptionRepository } from '../subscriptions/subscription.repository.js';
import type { AccessService } from '../access/access.service.js';
import type { BotContext } from '../../bot/context.js';
import { formatDateTime } from '../../bot/ui/helpers/formatDate.js';
import { daysUntilExpiration } from './reminder.logic.js';

const upcomingReminders = {
  3: { field: 'reminder3DaysSentAt', phrase: 'через 3 дня' },
  2: { field: 'reminder2DaysSentAt', phrase: 'послезавтра' },
  1: { field: 'reminder1DaySentAt', phrase: 'завтра' },
  0: { field: 'reminderTodaySentAt', phrase: 'сегодня' },
} as const;

export class ReminderService {
  constructor(
    private readonly bot: Bot<BotContext>,
    private readonly access: AccessService,
    private readonly logger: Logger,
    private readonly subscriptions = new SubscriptionRepository(),
  ) {}
  async run(now = new Date()): Promise<void> {
    const lookAhead = new Date(now.getTime() + 4 * 86_400_000);
    for (const item of await this.subscriptions.listActiveExpiringBetween(now, lookAhead)) {
      if (!item.expiresAt) continue;
      const days = daysUntilExpiration(item.expiresAt, now);
      if (days < 0 || days > 3) continue;
      const reminder = upcomingReminders[days as keyof typeof upcomingReminders];
      const claimed = await this.subscriptions.claimReminder(
        String(item._id),
        reminder.field,
        item.expiresAt,
      );
      if (!claimed) continue;
      const sent = await this.safeSend(
        item.telegramId,
        `⏳ <b>Доступ в клуб заканчивается ${reminder.phrase}</b>\n\nТочное время окончания: <b>${formatDateTime(item.expiresAt)}</b>.\n\nПродление на 30 дней стоит <b>1 000 ₽</b>. Оплатить его можно по кнопке ниже 💛`,
      );
      if (!sent)
        await this.subscriptions.releaseReminder(String(item._id), reminder.field, item.expiresAt);
      else
        this.logger.info({ type: `${days}_days`, telegramId: item.telegramId }, '⏰ REMINDER SENT');
    }
    for (const candidate of await this.subscriptions.listDueForExpiration(now)) {
      const expired = await this.subscriptions.expireAtomically(String(candidate._id), now);
      if (!expired) continue;
      this.logger.info({ telegramId: expired.telegramId }, '🔒 SUBSCRIPTION EXPIRED');
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
    for (const expired of await this.subscriptions.listExpiredNeedingRemoval()) {
      const pending = await this.subscriptions.markAccessRemovalPending(String(expired._id));
      if (pending && (await this.access.removeFromClub(expired.telegramId)))
        await this.subscriptions.markAccessRemoved(String(expired._id));
    }
  }
  private async safeSend(telegramId: string, text: string): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(Number(telegramId), text, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('💳 Продлить доступ · 1 000 ₽', 'reminder:renew'),
      });
      return true;
    } catch (error) {
      this.logger.warn(
        { errorType: error instanceof Error ? error.name : 'unknown', telegramId },
        'Reminder delivery failed',
      );
      return false;
    }
  }
}
