import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import type { PaymentProvider } from '../../modules/payments/PaymentProvider.js';
import type { PaymentService } from '../../modules/payments/payment.service.js';
import type { WebhookPayload } from '../../modules/payments/payment.types.js';
import type { PaymentDeliveryService } from '../../modules/payments/paymentDelivery.service.js';
import type { AppConfig } from '../../config/env.js';
export function registerRobokassaRoute(
  server: FastifyInstance,
  provider: PaymentProvider,
  payments: PaymentService,
  delivery: PaymentDeliveryService,
  logger: Logger,
  config: AppConfig,
): void {
  server.post<{ Body: WebhookPayload }>('/payments/robokassa/result', async (request, reply) => {
    if (provider.name !== 'robokassa') return reply.code(404).send({ error: 'Provider disabled' });
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
    if (result) void delivery.runOnce();
    return reply.type('text/plain').send(`OK${event.invoiceId}`);
  });
  const page = (title: string, message: string, start: string) => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#fffaf5;color:#26221e}main{box-sizing:border-box;max-width:440px;margin:20px;padding:32px;text-align:center;background:white;border-radius:18px;box-shadow:0 8px 32px #0001}h1{font-size:clamp(1.4rem,5vw,2rem);line-height:1.25}a{display:inline-block;margin-top:16px;padding:14px 22px;border-radius:10px;background:#e87745;color:white;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>${message}</h1><a href="https://t.me/${config.BOT_USERNAME}?start=${start}">Вернуться в Telegram</a></main></body></html>`;
  server.get<{ Querystring: { InvId?: string } }>(
    '/payments/robokassa/success',
    async (request, reply) => {
      const invoice = request.query.InvId;
      const start =
        typeof invoice === 'string' && /^[1-9]\d{0,9}$/.test(invoice)
          ? `payment_${invoice}`
          : 'payment_success';
      return reply
        .type('text/html; charset=utf-8')
        .send(page('Оплата завершена', 'Оплата завершена. Вернитесь в Telegram', start));
    },
  );
  server.get('/payments/robokassa/fail', async (_request, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .send(page('Оплата не завершена', 'Оплата не завершена', 'payment_failed')),
  );
}
