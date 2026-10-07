import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getActiveProducts, getProduct, type Product } from '../../config/products.js';
import { productsKeyboard, productKeyboard } from '../ui/keyboards/products.keyboard.js';
import { productMessage } from '../ui/messages/payment.message.js';
import { insideMessage } from '../ui/messages/start.message.js';
import { InlineKeyboard } from 'grammy';
import { renderScreen } from '../ui/renderScreen.js';

export async function renderProductCheckout(ctx: BotContext, product: Product): Promise<void> {
  if (!ctx.from) return;
  const user = await ctx.services.users.touch(ctx.from);
  const active = await ctx.services.subscriptions.getActive(String(ctx.from.id));
  const { payment } = await ctx.services.payments.createCheckout({
    userId: user._id,
    telegramId: String(ctx.from.id),
    productId: product.id,
    renewal: Boolean(active),
  });
  await renderScreen(ctx, {
    text: productMessage(product),
    keyboard: productKeyboard(product.id, payment.checkoutUrl!, ctx.config),
  });
}

export function registerProductHandlers(bot: Bot<BotContext>): void {
  bot.callbackQuery('inside', async (ctx) => {
    await renderScreen(ctx, {
      text: insideMessage,
      keyboard: new InlineKeyboard()
        .text('🍳 Вступить в клуб', 'products')
        .row()
        .text('← Назад', 'menu'),
    });
  });
  bot.callbackQuery('products', async (ctx) => {
    const products = getActiveProducts();
    if (products.length === 1) {
      await renderProductCheckout(ctx, products[0]!);
      return;
    }
    await renderScreen(ctx, {
      text: '🔍 <b>Выберите тариф</b>\n\nВсе тарифы открывают полный доступ к клубу.',
      keyboard: productsKeyboard(products),
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
