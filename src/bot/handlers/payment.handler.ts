import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getProduct } from '../../config/products.js';
import { formatDate } from '../ui/helpers/formatDate.js';
import { renderScreen } from '../ui/renderScreen.js';
import { renderProductCheckout } from './products.handler.js';

export function registerPaymentHandlers(bot: Bot<BotContext>): void {
  // Keep old checkout buttons from messages sent before this update usable.
  bot.callbackQuery(/^checkout:([a-z0-9_-]+)$/, async (ctx) => {
    const product = getProduct(ctx.match[1]!);
    if (product) await renderProductCheckout(ctx, product);
    else await renderScreen(ctx, { text: 'Тариф недоступен.' });
  });
  bot.callbackQuery(/^check:([0-9a-f-]{36})$/, async (ctx) => {
    const payment = await ctx.services.payments.refreshStatus(ctx.match[1]!);
    if (!payment || !ctx.from || payment.telegramId !== String(ctx.from.id)) {
      await renderScreen(ctx, {
        text: 'Платёж не найден.',
        keyboard: new InlineKeyboard().text('🏠 Главное меню', 'menu'),
      });
      return;
    }
    if (payment.status === 'succeeded') {
      await ctx.services.payments.processSuccess(String(payment._id));
      const subscription = ctx.from
        ? await ctx.services.subscriptions.getActive(String(ctx.from.id))
        : null;
      const invite = subscription
        ? await ctx.services.access.getOrCreateValidInvite(subscription)
        : undefined;
      const keyboard = new InlineKeyboard();
      if (invite) keyboard.url('👉 Вступить в закрытый клуб', invite).row();
      keyboard.text('🏠 Главное меню', 'menu');
      await renderScreen(ctx, {
        text: `🎉 <b>Оплата прошла!</b>\n\nДобро пожаловать в клуб 💛${subscription ? `\n\nТвой доступ активен: <b>${subscription.expiresAt ? `до ${formatDate(subscription.expiresAt)}` : 'навсегда'}</b>` : ''}`,
        keyboard,
      });
    } else {
      await renderScreen(ctx, {
        text:
          payment.status === 'canceled'
            ? '❌ <b>Оплата не завершена</b>\n\nМожно вернуться к тарифу и создать новый платёж.'
            : '⏳ <b>Оплата пока не найдена</b>\n\nПопробуйте проверить ещё раз через несколько секунд.',
        keyboard: new InlineKeyboard()
          .text('🔄 Проверить оплату', `check:${payment.publicId}`)
          .row()
          .text('← Назад', `product:${payment.productId}`),
      });
    }
  });
}
