import Fastify, { type FastifyInstance } from 'fastify';
import formbody from '@fastify/formbody';
import type { Bot } from 'grammy';
import type { Logger } from 'pino';
import type { AppConfig } from '../config/env.js';
import type { PaymentProvider } from '../modules/payments/PaymentProvider.js';
import type { PaymentService } from '../modules/payments/payment.service.js';
import type { AccessService } from '../modules/access/access.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { registerHealthRoute } from './routes/health.route.js';
import { registerPaymentReturnRoute } from './routes/paymentReturn.route.js';
import { registerRobokassaRoute } from './routes/robokassa.route.js';
import type { BotContext } from '../bot/context.js';
export async function createHttpServer(
  config: AppConfig,
  logger: Logger,
  provider: PaymentProvider,
  payments: PaymentService,
  access: AccessService,
  bot: Bot<BotContext>,
): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });
  await server.register(formbody);
  registerHealthRoute(server, config.NODE_ENV);
  registerPaymentReturnRoute(server, config, payments);
  registerRobokassaRoute(server, provider, payments, access, bot, logger, config);
  server.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, method: request.method, url: request.url }, 'HTTP request failed');
    const status = error instanceof AppError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    void reply.code(status).send({ error: status === 500 ? 'Internal server error' : message });
  });
  return server;
}
