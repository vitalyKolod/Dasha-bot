import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { startMessage, waitlistMessage } from '../ui/messages/start.message.js';
import { mainKeyboard } from '../ui/keyboards/main.keyboard.js';
import { renderScreen, type Screen } from '../ui/renderScreen.js';
import { formatDate } from '../ui/helpers/formatDate.js';

export async function buildWelcomeScreen(ctx: BotContext): Promise<Screen | null> {
  if (!ctx.from) return null;
  const subscription = await ctx.services.subscriptions.getActive(String(ctx.from.id));
  if (subscription)
    return {
      text: `💛 <b>Добро пожаловать в клуб!</b>\n\nДоступ активен ${subscription.expiresAt ? `до <b>${formatDate(subscription.expiresAt)}</b>` : '<b>навсегда</b>'}.\nОткрой «Мой аккаунт», чтобы перейти в закрытую группу.`,
      keyboard: mainKeyboard(true, ctx.config),
    };
  if (ctx.config.CHECKLIST_MODE)
    return {
      text: startMessage,
      keyboard: new InlineKeyboard()
        .text('🔍 Вступить в клуб', 'products')
        .row()
        .text('✨ Что внутри', 'inside')
        .row()
        .text('📄 Информация и условия', 'legal'),
    };
  return {
    text: ctx.config.PRE_REGISTRATION ? waitlistMessage : startMessage,
    keyboard: mainKeyboard(false, ctx.config),
  };
}

export async function showMainMenu(ctx: BotContext, newMessage = false): Promise<void> {
  const screen = await buildWelcomeScreen(ctx);
  if (screen) await renderScreen(ctx, screen, newMessage);
}

export async function sendWelcome(ctx: BotContext): Promise<void> {
  const screen = await buildWelcomeScreen(ctx);
  if (!screen) return;
  const options = {
    parse_mode: 'HTML' as const,
    ...(screen.keyboard ? { reply_markup: screen.keyboard } : {}),
  };
  if (ctx.config.CHECKLIST_MODE) await ctx.reply(screen.text, options);
  else if (ctx.config.START_IMAGE_FILE_ID)
    await ctx.replyWithPhoto(ctx.config.START_IMAGE_FILE_ID, { caption: screen.text, ...options });
  else if (ctx.config.START_VIDEO_FILE_ID)
    await ctx.replyWithVideo(ctx.config.START_VIDEO_FILE_ID, { caption: screen.text, ...options });
  else await renderScreen(ctx, screen);
}

export function registerMenuHandlers(bot: Bot<BotContext>): void {
  bot.callbackQuery('menu', async (ctx) => {
    await showMainMenu(ctx);
  });
  bot.callbackQuery('receipt:menu', async (ctx) => {
    await showMainMenu(ctx, true);
  });
}
