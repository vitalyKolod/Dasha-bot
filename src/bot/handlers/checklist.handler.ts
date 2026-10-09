import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { checklistMessage } from '../ui/messages/checklist.message.js';

export async function sendChecklist(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;
  await ctx.services.users.touch(ctx.from);
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
  await ctx.reply(checklistMessage, { parse_mode: 'HTML' });
}

export function registerChecklistHandlers(bot: Bot<BotContext>): void {
  bot.callbackQuery('checklist', sendChecklist);
}
