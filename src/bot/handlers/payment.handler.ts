import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getProduct } from '../../config/products.js';
import { formatDate } from '../ui/helpers/formatDate.js';
import { renderScreen } from '../ui/renderScreen.js';
import { renderProductCheckout } from './products.handler.js';
import { addPaymentSupportButton, paymentSupportHint } from '../ui/paymentSupport.js';

export function registerPaymentHandlers(bot: Bot<BotContext>): void {
  // Keep old checkout buttons from messages sent before this update usable.
  bot.callbackQuery(/^checkout:([a-z0-9_-]+)$/, async (ctx) => {
    const product = getProduct(ctx.match[1]!);
    if (product) await renderProductCheckout(ctx, product);
    else await renderScreen(ctx, { text: 'Тариф недоступен.' });
  });
  bot.callbackQuery(/^check:([0-9a-f-]{36})$/, async (ctx) => {
    let payment;
    try {
      payment = await ctx.services.payments.refreshStatus(ctx.match[1]!);
    } catch (error) {
      ctx.logger.warn(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Could not check payment status',
      );
      await renderScreen(ctx, {
        text: `⚠️ <b>Не удалось проверить оплату</b>\n\nПопробуйте ещё раз чуть позже. ${paymentSupportHint(ctx.config)}`,
        keyboard: addPaymentSupportButton(
          new InlineKeyboard().text('🔄 Проверить ещё раз', `check:${ctx.match[1]}`),
          ctx.config,
        ),
      });
      return;
    }
    if (!payment || !ctx.from || payment.telegramId !== String(ctx.from.id)) {
      await renderScreen(ctx, {
        text: `Платёж не найден. ${paymentSupportHint(ctx.config)}`,
        keyboard: addPaymentSupportButton(
          new InlineKeyboard().text('🏠 Главное меню', 'menu'),
          ctx.config,
        ),
      });
      return;
    }
    if (payment.status === 'succeeded') {
      let subscription;
      let access;
      try {
        await ctx.services.payments.processSuccess(String(payment._id));
        subscription = ctx.from
          ? await ctx.services.subscriptions.getActive(String(ctx.from.id))
          : null;
        if (!subscription) throw new Error('Paid subscription is not active');
        access = await ctx.services.access.getClubAccess(subscription);
        if (!access) throw new Error('Paid club invitation is unavailable');
      } catch (error) {
        ctx.logger.warn(
          { errorType: error instanceof Error ? error.name : 'unknown' },
          'Paid order access check failed',
        );
        await renderScreen(ctx, {
          text: `✅ <b>Оплата подтверждена</b>\n\nДоступ пока не удалось показать. Проверьте «Мой аккаунт» чуть позже. ${paymentSupportHint(ctx.config)}`,
          keyboard: addPaymentSupportButton(
            new InlineKeyboard().text('👤 Мой аккаунт', 'subscription'),
            ctx.config,
          ),
        });
        return;
      }
      const keyboard = new InlineKeyboard();
      if (access)
        keyboard
          .url(access.member ? '🍳 Открыть клуб' : '👉 Вступить в закрытый клуб', access.url)
          .row();
      keyboard.text('👤 Мой аккаунт', 'receipt:subscription').row();
      keyboard.text('🏠 Главное меню', 'receipt:menu');
      addPaymentSupportButton(keyboard, ctx.config);
      await renderScreen(ctx, {
        text: `🎉 <b>Оплата прошла!</b>\n\nДобро пожаловать в клуб 💛${subscription ? `\n\nТвой доступ активен: <b>${subscription.expiresAt ? `до ${formatDate(subscription.expiresAt)}` : 'навсегда'}</b>` : ''}`,
        keyboard,
      });
    } else {
      await renderScreen(ctx, {
        text:
          payment.status === 'canceled'
            ? `❌ <b>Оплата не завершена</b>\n\nЕсли платёж не проходил, можно вернуться к тарифу. ${paymentSupportHint(ctx.config)}`
            : `⏳ <b>Оплата пока не найдена</b>\n\nПопробуйте проверить ещё раз через несколько секунд. ${paymentSupportHint(ctx.config)}`,
        keyboard: addPaymentSupportButton(
          new InlineKeyboard()
            .text('🔄 Проверить оплату', `check:${payment.publicId}`)
            .row()
            .text('← Назад', `product:${payment.productId}`),
          ctx.config,
        ),
      });
    }
  });
}
