import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { InlineKeyboard } from 'grammy';
import { renderScreen } from '../ui/renderScreen.js';
export function registerSupportHandler(bot: Bot<BotContext>): void {
  bot.callbackQuery('support', async (ctx) => {
    await renderScreen(ctx, {
      text: ctx.config.SUPPORT_USERNAME
        ? `Напишите: @${ctx.config.SUPPORT_USERNAME.replace(/^@/, '')}`
        : 'Контакт поддержки пока не настроен.',
      keyboard: new InlineKeyboard().text('← Назад', 'menu'),
    });
  });
}
