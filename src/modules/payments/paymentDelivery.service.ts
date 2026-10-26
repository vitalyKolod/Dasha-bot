import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { Logger } from 'pino';
import type { BotContext } from '../../bot/context.js';
import { paymentSuccessMessage } from '../../bot/ui/messages/paymentSuccess.message.js';
import type { AccessService } from '../access/access.service.js';
import { SubscriptionService } from '../subscriptions/subscription.service.js';
import { PaymentRepository } from './payment.repository.js';

export class PaymentDeliveryService {
  private running = false;
  private timer?: NodeJS.Timeout;
  constructor(
    private readonly bot: Bot<BotContext>,
    private readonly access: AccessService,
    private readonly logger: Logger,
    private readonly payments = new PaymentRepository(),
    private readonly subscriptions = new SubscriptionService(),
  ) {}
  start() {
    this.timer = setInterval(() => void this.runOnce(), 10_000);
    void this.runOnce();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }
  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 20; i++) {
        const payment = await this.payments.claimDelivery();
        if (!payment) break;
        try {
          const subscription = await this.subscriptions.getActive(payment.telegramId);
          if (!subscription) throw new Error('Subscription missing for paid order');
          const access = await this.access.getClubAccess(subscription);
          if (!access) throw new Error('Private club chat is not configured');
          const keyboard = new InlineKeyboard()
            .text(
              access.member ? '🍳 Открыть клуб' : '👉 Получить ссылку для входа',
              'receipt:club',
            )
            .row()
            .text('👤 Мой аккаунт', 'receipt:subscription')
            .row()
            .text('🏠 Главное меню', 'receipt:menu');
          await this.bot.api.sendMessage(
            Number(payment.telegramId),
            paymentSuccessMessage(payment.purpose, subscription.expiresAt),
            { parse_mode: 'HTML', reply_markup: keyboard },
            AbortSignal.timeout(12_000) as unknown as Parameters<
              typeof this.bot.api.sendMessage
            >[3],
          );
          await this.payments.markDelivered(String(payment._id));
        } catch (error) {
          await this.payments.retryDelivery(String(payment._id), payment.deliveryAttempts ?? 1);
          this.logger.warn(
            {
              errorType: error instanceof Error ? error.name : 'unknown',
              payment: payment.publicId,
            },
            'Payment invitation delivery failed; retry scheduled',
          );
        }
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Payment delivery worker failed');
    } finally {
      this.running = false;
    }
  }
}
