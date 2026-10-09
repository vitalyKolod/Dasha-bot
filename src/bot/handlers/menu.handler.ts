import { InlineKeyboard, type Bot } from 'grammy';
import { checklistWelcome } from '../ui/messages/checklist.message.js';
import type { BotContext } from '../context.js';
import { startMessage, waitlistMessage } from '../ui/messages/start.message.js';
import { mainKeyboard } from '../ui/keyboards/main.keyboard.js';
import { renderScreen, type Screen } from '../ui/renderScreen.js';

export async function buildWelcomeScreen(ctx: BotContext): Promise<Screen | null> {
  if (!ctx.from) return null;
  if (ctx.config.CHECKLIST_MODE)
    return {
      text: checklistWelcome,
      keyboard: new InlineKeyboard().text('❄️ Получить чек-лист', 'checklist'),
    };
  const subscription = await ctx.services.subscriptions.getActive(String(ctx.from.id));
  const invite = subscription
    ? await ctx.services.access.getOrCreateValidInvite(subscription)
    : undefined;
  return {
    text: ctx.config.PRE_REGISTRATION ? waitlistMessage : startMessage,
    keyboard: mainKeyboard(Boolean(subscription), ctx.config, invite),
  };
}

export async function showMainMenu(ctx: BotContext): Promise<void> {
  const screen = await buildWelcomeScreen(ctx);
  if (screen) await renderScreen(ctx, screen);
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
}
