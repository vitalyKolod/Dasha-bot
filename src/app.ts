import mongoose from 'mongoose';
import type { Logger } from 'pino';
import { loadConfig } from './config/env.js';
import { createLogger, logBanner } from './shared/logger.js';
import { createPaymentProvider } from './modules/payments/paymentProvider.factory.js';
import { UserService } from './modules/users/user.service.js';
import { SubscriptionService } from './modules/subscriptions/subscription.service.js';
import { PaymentService } from './modules/payments/payment.service.js';
import { createBot } from './bot/bot.js';
import { resumeBroadcasts } from './bot/handlers/admin/admin.handler.js';
import { createAccessService } from './modules/access/access.service.js';
import type { Services } from './bot/context.js';
import { createHttpServer } from './http/server.js';
import { ReminderService } from './modules/reminders/reminder.service.js';
import { ReminderScheduler } from './modules/reminders/reminder.scheduler.js';

export async function startApplication() {
  const config = loadConfig();
  const logger = createLogger(config);
  logBanner(logger, '🚀 ДАША BOT STARTING');
  logger.info('✅ Environment validated');
  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info('✅ MongoDB connected');
  } catch (error) {
    logger.fatal({ err: error }, '❌ MongoDB connection failed');
    throw error;
  }
  const provider = createPaymentProvider(config);
  if (provider.name === 'mock') logger.warn('🧪 PAYMENT MODE: MOCK — НЕ ИСПОЛЬЗОВАТЬ В PRODUCTION');
  const serviceHolder: { value?: Services } = {};
  const bot = createBot(config, logger, () => {
    if (!serviceHolder.value) throw new Error('Services not initialized');
    return serviceHolder.value;
  });
  try {
    await bot.init();
    config.BOT_USERNAME ??= bot.botInfo.username;
    logger.info({ username: `@${bot.botInfo.username}` }, '✅ Telegram bot connected');
  } catch (error) {
    logger.fatal({ err: error }, '❌ Telegram bot initialization failed');
    await mongoose.disconnect();
    throw error;
  }
  const subscriptions = new SubscriptionService();
  const access = createAccessService(bot, config, logger);
  const payments = new PaymentService(provider, config, logger);
  serviceHolder.value = { users: new UserService(), subscriptions, payments, access };
  if (config.PRIVATE_CLUB_CHAT_ID) {
    try {
      const member = await bot.api.getChatMember(config.PRIVATE_CLUB_CHAT_ID, bot.botInfo.id);
      logger.info({ status: member.status }, '✅ Club group access verified');
    } catch (error) {
      logger.warn({ err: error }, '⚠️ Cannot verify club permissions');
    }
  }
  const server = await createHttpServer(config, logger, provider, payments, access, bot);
  const address = await server.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info({ address }, '✅ HTTP server started');
  const reminders = new ReminderScheduler(
    config.REMINDER_CRON,
    new ReminderService(bot, access, logger),
    logger,
  );
  reminders.start();
  await resumeBroadcasts(bot, logger);
  void bot.start({
    onStart: ({ username }) =>
      logger.info({ username: `@${username}` }, '✅ Telegram polling started'),
  });
  logBanner(logger, '✅ BOT IS READY');
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Graceful shutdown started');
    await reminders.stop();
    await bot.stop();
    await server.close();
    await mongoose.disconnect();
    logger.info('Graceful shutdown complete');
  };
  return { config, logger, bot, server, shutdown };
}

export function installProcessHandlers(
  logger: Logger,
  shutdown: (signal: string) => Promise<void>,
): void {
  process.once('SIGINT', () => void shutdown('SIGINT').finally(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown('SIGTERM').finally(() => process.exit(0)));
  process.on('unhandledRejection', (error) => logger.fatal({ err: error }, 'Unhandled rejection'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    void shutdown('uncaughtException').finally(() => process.exit(1));
  });
}
