import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getActiveProducts, getProduct, type Product } from '../../config/products.js';
import { productsKeyboard, productKeyboard } from '../ui/keyboards/products.keyboard.js';
import { productMessage, productSelectionMessage } from '../ui/messages/payment.message.js';
import { insideMessage } from '../ui/messages/start.message.js';
import { InlineKeyboard } from 'grammy';
import { showWaitlist } from './waitlist.handler.js';
import { renderScreen } from '../ui/renderScreen.js';

export async function renderProductCheckout(
  ctx: BotContext,
  product: Product,
  testCheckout = false,
): Promise<void> {
  if (!ctx.from) return;
  const testAccess =
    ctx.config.PAYMENT_PROVIDER === 'robokassa' &&
    ctx.config.ROBOKASSA_TEST_MODE &&
    (testCheckout || ctx.config.adminIds.has(String(ctx.from.id)));
  if (ctx.config.CHECKLIST_MODE && !testAccess) {
    const renewal = await ctx.services.payments.hasPaidBefore(String(ctx.from.id));
    await renderScreen(ctx, {
      text: productMessage(renewal ? getProduct('monthly')! : product, false, renewal),
      keyboard: productKeyboard(product.id, null, ctx.config),
    });
    return;
  }
  if (ctx.config.PRE_REGISTRATION && !testAccess) {
    await showWaitlist(ctx);
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
    text: productMessage(checkoutProduct, true, payment.purpose === 'renewal'),
    keyboard: productKeyboard(checkoutProduct.id, payment.checkoutUrl!, ctx.config),
  });
}

export function registerProductHandlers(bot: Bot<BotContext>): void {
  bot.command('testpayment', async (ctx) => {
    if (!ctx.from || ctx.config.PAYMENT_PROVIDER !== 'robokassa' || !ctx.config.ROBOKASSA_TEST_MODE)
      return;
    const renewal = await ctx.services.payments.hasPaidBefore(String(ctx.from.id));
    await ctx.reply(productSelectionMessage(renewal, true), {
      parse_mode: 'HTML',
      reply_markup: productsKeyboard(getActiveProducts(), 'testpayment', renewal),
    });
  });
  bot.callbackQuery(/^testpayment:([a-z0-9_-]+)$/, async (ctx) => {
    if (ctx.config.PAYMENT_PROVIDER !== 'robokassa' || !ctx.config.ROBOKASSA_TEST_MODE) return;
    const product = getProduct(ctx.match[1]!);
    if (!product) return;
    await renderProductCheckout(ctx, product, true);
  });
  bot.callbackQuery('inside', async (ctx) => {
    await renderScreen(ctx, {
      text: insideMessage,
      keyboard: new InlineKeyboard()
        .text(
          ctx.config.CHECKLIST_MODE
            ? '🔍 Клуб и тарифы'
            : ctx.config.PRE_REGISTRATION
              ? '❤️ ЖДУ ОТКРЫТИЯ'
              : '🍳 Вступить в клуб',
          ctx.config.CHECKLIST_MODE || !ctx.config.PRE_REGISTRATION ? 'products' : 'waitlist',
        )
        .row()
        .text('← Назад', 'menu'),
    });
  });
  bot.callbackQuery('products', async (ctx) => {
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
      text: productSelectionMessage(renewal),
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
