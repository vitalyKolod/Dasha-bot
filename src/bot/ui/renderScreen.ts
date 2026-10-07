import { GrammyError, type InlineKeyboard } from 'grammy';
import type { BotContext } from '../context.js';

export interface Screen {
  text: string;
  keyboard?: InlineKeyboard;
  parseMode?: 'HTML';
}

const isNotModified = (error: unknown): boolean =>
  error instanceof GrammyError &&
  error.description.toLowerCase().includes('message is not modified');

/** Renders callback navigation in place and falls back to a new text message when editing is impossible. */
export async function renderScreen(ctx: BotContext, screen: Screen): Promise<void> {
  const options = {
    parse_mode: screen.parseMode ?? ('HTML' as const),
    ...(screen.keyboard ? { reply_markup: screen.keyboard } : {}),
  };

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch((error: unknown) => {
      ctx.logger.debug({ err: error }, 'Callback query was already answered or expired');
    });

    if (ctx.callbackQuery.message) {
      try {
        const message = ctx.callbackQuery.message;
        if ('photo' in message || 'video' in message) {
          await ctx.editMessageCaption({ caption: screen.text, ...options });
        } else {
          await ctx.editMessageText(screen.text, options);
        }
        return;
      } catch (error) {
        if (isNotModified(error)) return;
        ctx.logger.warn({ err: error }, 'Could not edit UI message; sending a new panel');
      }
    }
  }

  await ctx.reply(screen.text, options);
}
