import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getProduct } from '../../config/products.js';
import { formatDate } from '../ui/helpers/formatDate.js';
import { renderScreen } from '../ui/renderScreen.js';
export function registerSubscriptionHandler(bot: Bot<BotContext>): void {
  bot.callbackQuery('subscription', async (ctx) => {
    if (!ctx.from) return;
    const subscription = await ctx.services.subscriptions.getActive(String(ctx.from.id));
    if (!subscription) {
      await renderScreen(ctx, {
        text: '👤 <b>Моя подписка</b>\n\nАктивной подписки нет.',
        keyboard: new InlineKeyboard()
          .text('🍳 Вступить в клуб', 'products')
          .row()
          .text('← Назад', 'menu'),
      });
      return;
    }
    const invite = await ctx.services.access.getOrCreateValidInvite(subscription);
    const product = getProduct(subscription.productId);
    const keyboard = new InlineKeyboard();
    if (invite) keyboard.url('🍳 Перейти в клуб', invite).row();
    keyboard.text('💳 Продлить', 'products').row().text('← Назад', 'menu');
    await renderScreen(ctx, {
      text: `👤 <b>Моя подписка</b>\n\nСтатус:\n🟢 Активна\n\nТариф:\n<b>${product?.title ?? subscription.productId}</b>\n\nДоступ до:\n<b>${subscription.expiresAt ? formatDate(subscription.expiresAt) : '♾ Навсегда'}</b>`,
      keyboard,
    });
  });
}
