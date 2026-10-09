import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { UserModel } from '../../modules/users/user.model.js';
import { renderScreen } from '../ui/renderScreen.js';
import { waitlistMessage } from '../ui/messages/start.message.js';

export async function showWaitlist(ctx: BotContext): Promise<void> {
  await renderScreen(ctx, {
    text: waitlistMessage,
    keyboard: new InlineKeyboard().text('❤️ ЖДУ ОТКРЫТИЯ', 'waitlist'),
  });
}

export async function joinWaitlist(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;
  await ctx.services.users.touch(ctx.from);
  const user = await UserModel.findOne({ telegramId: String(ctx.from.id) });
  await UserModel.updateOne(
    { telegramId: String(ctx.from.id), waitlistJoinedAt: { $exists: false } },
    {
      $set: {
        waitlistJoinedAt: new Date(),
        ...(user?.lastSourceCode ? { waitlistSourceCode: user.lastSourceCode } : {}),
      },
    },
  );
  await renderScreen(ctx, {
    text: 'Готово, ты в списке ожидающих! ❤️\n\nКак только откроется наш закрытый Telegram-канал «Даша. Заготовки и меню», я пришлю сюда уведомление и ссылку для вступления. Сейчас ничего оплачивать не нужно.',
    keyboard: new InlineKeyboard().text('🏠 Главное меню', 'menu'),
  });
}

export function registerWaitlistHandlers(bot: Bot<BotContext>): void {
  bot.callbackQuery('waitlist', joinWaitlist);
}
