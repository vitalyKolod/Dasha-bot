import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getProduct } from '../../config/products.js';
import { formatDate } from '../ui/helpers/formatDate.js';
import { renderScreen } from '../ui/renderScreen.js';
import { addPaymentSupportButton } from '../ui/paymentSupport.js';

export async function showAccount(
  ctx: BotContext,
  refreshInvite = false,
  newMessage = false,
): Promise<void> {
  if (!ctx.from) return;
  const subscription = await ctx.services.subscriptions.getActive(String(ctx.from.id));
  if (!subscription) {
    await renderScreen(
      ctx,
      {
        text: '👤 <b>Мой аккаунт</b>\n\nАктивного доступа сейчас нет.',
        keyboard: new InlineKeyboard()
          .text('🍳 Посмотреть тарифы', 'products')
          .row()
          .text('← Назад', 'menu'),
      },
      newMessage,
    );
    return;
  }

  let access;
  try {
    access = await ctx.services.access.getClubAccess(subscription, refreshInvite);
  } catch {
    ctx.logger.warn({ telegramId: ctx.from.id }, 'Club access could not be checked');
  }
  const product = getProduct(subscription.productId);
  const keyboard = new InlineKeyboard();
  if (access)
    keyboard
      .url(access.member ? '🍳 Открыть клуб' : '👉 Вступить в закрытый клуб', access.url)
      .row();
  if (!access?.member) keyboard.text('🔄 Обновить ссылку', 'subscription:refresh').row();
  if (!access?.member && ctx.config.SUPPORT_USERNAME)
    addPaymentSupportButton(keyboard, ctx.config, '💬 Проблема со входом').row();
  keyboard.text('🏠 Главное меню', 'menu');
  await renderScreen(
    ctx,
    {
      text: `👤 <b>Мой аккаунт</b>\n\n🟢 Доступ активен\n🍳 Тариф: <b>${product?.title ?? subscription.productId}</b>\n📅 Оплачено до: <b>${subscription.expiresAt ? formatDate(subscription.expiresAt) : 'навсегда'}</b>\n\n${access?.member ? '✅ Вы уже в закрытой группе.' : access ? '🔐 Вступить в группу можно по кнопке ниже. Заявку одобрит бот только для вашего аккаунта.' : 'Ссылка временно недоступна. Нажмите «Обновить ссылку».'}`,
      keyboard,
    },
    newMessage,
  );
}

export function registerSubscriptionHandler(bot: Bot<BotContext>): void {
  bot.callbackQuery('subscription', async (ctx) => showAccount(ctx));
  bot.callbackQuery('receipt:subscription', async (ctx) => showAccount(ctx, false, true));
  bot.callbackQuery('subscription:refresh', async (ctx) => showAccount(ctx, true));
}
