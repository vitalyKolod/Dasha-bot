import { Bot, GrammyError, HttpError } from 'grammy';
import { lookup as dnsLookup } from 'node:dns';
import { Agent } from 'node:https';
import type { Logger } from 'pino';
import type { AppConfig } from '../config/env.js';
import type { BotContext, Services } from './context.js';
import { registerChecklistHandlers } from './handlers/checklist.handler.js';
import { sendWelcome, showMainMenu } from './handlers/menu.handler.js';
import { registerWaitlistHandlers } from './handlers/waitlist.handler.js';
import { registerStartHandler } from './handlers/start.handler.js';
import { registerMenuHandlers } from './handlers/menu.handler.js';
import { registerProductHandlers } from './handlers/products.handler.js';
import { registerPaymentHandlers } from './handlers/payment.handler.js';
import { registerSubscriptionHandler } from './handlers/subscription.handler.js';
import { registerSupportHandler } from './handlers/support.handler.js';
import { registerAdminHandlers } from './handlers/admin/admin.handler.js';

export function createBot(
  config: AppConfig,
  logger: Logger,
  getServices: () => Services,
): Bot<BotContext> {
  const client = config.TELEGRAM_API_IP
    ? {
        baseFetchConfig: {
          agent: new Agent({
            keepAlive: true,
            lookup: (hostname, options, callback) => {
              if (hostname !== 'api.telegram.org') return dnsLookup(hostname, options, callback);
              const address = config.TELEGRAM_API_IP!;
              if (options.all) callback(null, [{ address, family: 4 }]);
              else callback(null, address, 4);
            },
          }),
        },
      }
    : undefined;
  const bot = client
    ? new Bot<BotContext>(config.BOT_TOKEN, { client })
    : new Bot<BotContext>(config.BOT_TOKEN);
  bot.use(async (ctx, next) => {
    ctx.config = config;
    ctx.logger = logger;
    ctx.services = getServices();
    await next();
  });
  bot.use(async (ctx, next) => {
    if (!config.CHECKLIST_MODE || (ctx.from && config.adminIds.has(String(ctx.from.id)))) {
      await next();
      return;
    }
    if (ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'checklist') await next();
      else await showMainMenu(ctx);
      return;
    }
    if (ctx.message?.text && /^\/start(?:@\w+)?(?:\s|$)/.test(ctx.message.text)) {
      await next();
      return;
    }
    if (ctx.message?.text?.startsWith('/')) {
      if (ctx.from) await ctx.services.users.touch(ctx.from);
      await sendWelcome(ctx);
    }
  });
  registerChecklistHandlers(bot);
  registerStartHandler(bot);
  registerMenuHandlers(bot);
  registerWaitlistHandlers(bot);
  registerProductHandlers(bot);
  registerPaymentHandlers(bot);
  registerSubscriptionHandler(bot);
  registerSupportHandler(bot);
  registerAdminHandlers(bot);
  bot.catch(({ error, ctx }) => {
    if (error instanceof GrammyError)
      logger.error(
        { description: error.description, updateId: ctx.update.update_id },
        'Telegram API error',
      );
    else if (error instanceof HttpError)
      logger.error({ err: error, updateId: ctx.update.update_id }, 'Telegram network error');
    else logger.error({ err: error, updateId: ctx.update.update_id }, 'Bot handler error');
  });
  return bot;
}
