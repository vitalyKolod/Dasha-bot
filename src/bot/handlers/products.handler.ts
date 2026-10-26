import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getActiveProducts, getProduct, type Product } from '../../config/products.js';
import { productsKeyboard, productKeyboard } from '../ui/keyboards/products.keyboard.js';
import {
  productMessage,
  productSelectionMessage,
  salesOpeningNotice,
} from '../ui/messages/payment.message.js';
import { insideMessage } from '../ui/messages/start.message.js';
import { InlineKeyboard } from 'grammy';
import { showWaitlist } from './waitlist.handler.js';
import { showMainMenu } from './menu.handler.js';
import { renderScreen } from '../ui/renderScreen.js';

export async function renderProductCheckout(ctx: BotContext, product: Product): Promise<void> {
  if (!ctx.from) return;
  if (ctx.config.PRE_REGISTRATION) {
    await showWaitlist(ctx);
    return;
  }
  if (!ctx.config.PUBLIC_PAYMENTS_ENABLED) {
    const renewal = await ctx.services.payments.hasPaidBefore(String(ctx.from.id));
    const displayProduct = renewal ? getProduct('monthly')! : product;
    await renderScreen(ctx, {
      text: productMessage(displayProduct, false, renewal),
      keyboard: productKeyboard(displayProduct.id, null, ctx.config),
    });
    return;
  }
  const user = await ctx.services.users.touch(ctx.from);
  const { payment } = await ctx.services.payments.createCheckout({
    userId: user._id,
    telegramId: String(ctx.from.id),
    productId: product.id,
  });
  const checkoutProduct = getProduct(payment.productId)!;
  await renderScreen(ctx, {
    text: `${ctx.config.PAYMENT_PROVIDER === 'robokassa' && ctx.config.ROBOKASSA_TEST_MODE ? '🧪 <b>Тестовая оплата · деньги не списываются</b>\n\n' : ''}${productMessage(checkoutProduct, true, payment.purpose === 'renewal')}`,
    keyboard: productKeyboard(checkoutProduct.id, payment.checkoutUrl!, ctx.config),
  });
}

export function registerProductHandlers(bot: Bot<BotContext>): void {
  bot.callbackQuery('inside', async (ctx) => {
    const active = ctx.from
      ? await ctx.services.subscriptions.getActive(String(ctx.from.id))
      : null;
    await renderScreen(ctx, {
      text: insideMessage,
      keyboard: new InlineKeyboard()
        .text(
          active
            ? '👤 Мой аккаунт'
            : ctx.config.CHECKLIST_MODE
              ? '🔍 Клуб и тарифы'
              : ctx.config.PRE_REGISTRATION
                ? '❤️ ЖДУ ОТКРЫТИЯ'
                : '🍳 Вступить в клуб',
          active
            ? 'subscription'
            : ctx.config.CHECKLIST_MODE || !ctx.config.PRE_REGISTRATION
              ? 'products'
              : 'waitlist',
        )
        .row()
        .text('← Назад', 'menu'),
    });
  });
  bot.callbackQuery('products', async (ctx) => {
    const previousMessage = ctx.callbackQuery?.message;
    const previousText = previousMessage
      ? 'text' in previousMessage
        ? previousMessage.text
        : 'caption' in previousMessage
          ? previousMessage.caption
          : undefined
      : undefined;
    if (getActiveProducts().length === 1 && previousText?.includes('Клуб Даши ·')) {
      await showMainMenu(ctx);
      return;
    }
    if (
      ctx.config.PRE_REGISTRATION &&
      !ctx.config.CHECKLIST_MODE &&
      !(
        ctx.config.PAYMENT_PROVIDER === 'robokassa' &&
        ctx.config.ROBOKASSA_TEST_MODE &&
        ctx.from &&
        ctx.config.adminIds.has(String(ctx.from.id))
      )
    ) {
      await showWaitlist(ctx);
      return;
    }
    const products = getActiveProducts();
    const renewal = ctx.from
      ? await ctx.services.payments.hasPaidBefore(String(ctx.from.id))
      : false;
    if (products.length === 1) {
      await renderProductCheckout(ctx, products[0]!);
      return;
    }
    await renderScreen(ctx, {
      text: `${productSelectionMessage(renewal, ctx.config.PAYMENT_PROVIDER === 'robokassa' && ctx.config.ROBOKASSA_TEST_MODE)}\n\n${ctx.config.PUBLIC_PAYMENTS_ENABLED ? '' : salesOpeningNotice}`.trim(),
      keyboard: productsKeyboard(products, 'product', renewal),
    });
  });
  bot.callbackQuery(/^product:([a-z0-9_-]+)$/, async (ctx) => {
    const product = getProduct(ctx.match[1]!);
    if (!product) {
      await renderScreen(ctx, {
        text: 'Тариф недоступен.',
        keyboard: new InlineKeyboard().text('← Назад', 'products'),
      });
      return;
    }
    await renderProductCheckout(ctx, product);
  });
  // Previously sent buttons still work after deployment.
  bot.callbackQuery(/^terms:([a-z0-9_-]+)$/, async (ctx) => {
    const product = getProduct(ctx.match[1]!);
    if (product) await renderProductCheckout(ctx, product);
    else
      await renderScreen(ctx, {
        text: 'Тариф недоступен.',
        keyboard: productsKeyboard(getActiveProducts()),
      });
  });
}
