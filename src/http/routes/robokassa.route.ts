import type { FastifyInstance } from 'fastify';
import type { Bot } from 'grammy';
import type { Logger } from 'pino';
import type { PaymentProvider } from '../../modules/payments/PaymentProvider.js';
import type { PaymentService } from '../../modules/payments/payment.service.js';
import type { WebhookPayload } from '../../modules/payments/payment.types.js';
import type { AccessService } from '../../modules/access/access.service.js';
import { formatDate } from '../../bot/ui/helpers/formatDate.js';
import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../../bot/context.js';
import type { AppConfig } from '../../config/env.js';
export function registerRobokassaRoute(
  server: FastifyInstance,
  provider: PaymentProvider,
  payments: PaymentService,
  access: AccessService,
  bot: Bot<BotContext>,
  logger: Logger,
  config: AppConfig,
): void {
  server.post<{ Body: WebhookPayload }>(
    '/api/payments/robokassa/result',
    async (request, reply) => {
      if (provider.name !== 'robokassa')
        return reply.code(404).send({ error: 'Provider disabled' });
      let event;
      try {
        event = provider.verifyWebhook(request.body);
      } catch (error) {
        logger.warn(
          { reason: error instanceof Error ? error.message : 'Invalid webhook' },
          'Robokassa webhook rejected',
        );
        throw error;
      }
      logger.info({ provider: 'robokassa', invoice: event.invoiceId }, '🔔 PAYMENT WEBHOOK');
      const result = await payments.handleVerifiedEvent(event);
      if (result && 'subscription' in result) {
        try {
          const invite = await access.getOrCreateValidInvite(result.subscription);
          const keyboard = new InlineKeyboard();
          if (invite) keyboard.url('👉 Вступить в закрытый клуб', invite).row();
          keyboard.text('🏠 Главное меню', 'menu');
          await bot.api.sendMessage(
            Number(result.payment.telegramId),
            `🎉 <b>Оплата прошла!</b>\n\nДобро пожаловать в клуб 💛\n\nТвой доступ активен: <b>${result.subscription.expiresAt ? `до ${formatDate(result.subscription.expiresAt)}` : 'навсегда'}</b>`,
            { parse_mode: 'HTML', reply_markup: keyboard },
          );
        } catch (error) {
          logger.warn({ err: error }, 'Payment notification delivery failed');
        }
      }
      return reply.type('text/plain').send(`OK${event.invoiceId}`);
    },
  );
  server.get('/api/payments/robokassa/success', async (_request, reply) =>
    reply.redirect(`https://t.me/${config.BOT_USERNAME}?start=payment_success`),
  );
  server.get('/api/payments/robokassa/fail', async (_request, reply) =>
    reply.redirect(`https://t.me/${config.BOT_USERNAME}?start=payment_failed`),
  );
}
