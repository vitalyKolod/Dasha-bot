import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../../config/env.js';
import type { PaymentService } from '../../modules/payments/payment.service.js';
export function registerPaymentReturnRoute(
  server: FastifyInstance,
  config: AppConfig,
  payments: PaymentService,
): void {
  server.get<{ Querystring: { token?: string } }>('/payment/return', async (request, reply) => {
    const parsed = z
      .string()
      .regex(/^[A-Za-z0-9_-]{40,100}$/)
      .safeParse(request.query.token);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid token' });
    const record = await payments.returnTokens.resolve(parsed.data);
    if (!record) return reply.code(410).send({ error: 'Link expired' });
    return reply.redirect(`https://t.me/${config.BOT_USERNAME}?start=pay_${parsed.data}`);
  });
}
