import { InlineKeyboard } from 'grammy';
import {
  getActiveProducts,
  RENEWAL_PRICE_KOPECKS,
  type Product,
} from '../../../config/products.js';
import type { AppConfig } from '../../../config/env.js';
import { formatMoney } from '../helpers/formatMoney.js';

export const productsKeyboard = (
  products: readonly Product[],
  callbackPrefix = 'product',
  renewal = false,
) => {
  const keyboard = new InlineKeyboard();
  if (renewal)
    return keyboard
      .text(
        `🔁 Продлить на месяц · ${formatMoney(RENEWAL_PRICE_KOPECKS)}`,
        `${callbackPrefix}:monthly`,
      )
      .row()
      .text('← Назад', 'menu');
  products.forEach((product) =>
    keyboard
      .text(
        `${product.id === 'monthly' ? '🌿' : '✨'} ${product.title} · ${formatMoney(product.price)}`,
        `${callbackPrefix}:${product.id}`,
      )
      .row(),
  );
  return keyboard.text('← Назад', 'menu');
};

export const productKeyboard = (
  productId: string,
  checkoutUrl: string | null,
  config: AppConfig,
  renewal = false,
) => {
  const keyboard = new InlineKeyboard();
  if (checkoutUrl)
    keyboard
      .url(renewal ? '💳 Продлить доступ · 1 000 ₽' : '💳 Перейти к оплате', checkoutUrl)
      .row();
  keyboard.text('📄 Информация и условия', `legal:${productId}`).row();
  if (config.OFFER_URL) keyboard.url('📄 Оферта', config.OFFER_URL);
  if (config.PRIVACY_URL) keyboard.url('🔐 Политика', config.PRIVACY_URL);
  return keyboard
    .row()
    .text('← Назад', getActiveProducts().length === 1 ? 'menu' : 'products')
    .row()
    .text('🏠 Главное меню', 'menu');
};
