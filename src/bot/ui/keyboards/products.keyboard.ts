import { InlineKeyboard } from 'grammy';
import type { Product } from '../../../config/products.js';
import type { AppConfig } from '../../../config/env.js';
import { formatMoney } from '../helpers/formatMoney.js';

export const productsKeyboard = (products: readonly Product[]) => {
  const keyboard = new InlineKeyboard();
  products.forEach((product) =>
    keyboard
      .text(`${product.title} — ${formatMoney(product.price)}`, `product:${product.id}`)
      .row(),
  );
  return keyboard.text('← Назад', 'menu');
};

export const productKeyboard = (productId: string, checkoutUrl: string, config: AppConfig) => {
  const keyboard = new InlineKeyboard().url('💳 Перейти к оплате', checkoutUrl).row();
  if (config.OFFER_URL) keyboard.url('📄 Оферта', config.OFFER_URL);
  if (config.PRIVACY_URL) keyboard.url('🔐 Политика', config.PRIVACY_URL);
  return keyboard.row().text('← Назад', 'products').row().text('🏠 Главное меню', 'menu');
};
