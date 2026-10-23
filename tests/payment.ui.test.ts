import { describe, expect, it } from 'vitest';
import { productKeyboard, productsKeyboard } from '../src/bot/ui/keyboards/products.keyboard.js';
import { productMessage, productSelectionMessage } from '../src/bot/ui/messages/payment.message.js';
import { getActiveProducts, getProduct } from '../src/config/products.js';
import type { AppConfig } from '../src/config/env.js';

describe('product checkout screen', () => {
  it('shows the agreed base prices for both active tariffs', () => {
    expect(getProduct('monthly')?.price).toBe(200000);
    expect(getProduct('quarterly')?.price).toBe(300000);
    expect(productMessage(getProduct('monthly')!).replace(/\s/g, ' ')).toContain('2 000 ₽');
    expect(productMessage(getProduct('quarterly')!).replace(/\s/g, ' ')).toContain('3 000 ₽');
    expect(productMessage(getProduct('monthly')!).replace(/\s/g, ' ')).toContain(
      'Следующий месяц — <b>1 000 ₽</b>',
    );
    expect(productMessage(getProduct('monthly')!, true, true).replace(/\s/g, ' ')).toContain(
      'Стоимость: <b>1 000 ₽</b>',
    );
  });
  it('keeps tariff choices and the renewal price easy to scan', () => {
    const choices = productsKeyboard(getActiveProducts()).inline_keyboard.flat();
    expect(choices[0]?.text.replace(/\s/g, ' ')).toContain('1 месяц · 2 000 ₽');
    expect(choices[1]?.text.replace(/\s/g, ' ')).toContain('3 месяца · 3 000 ₽');
    expect(productSelectionMessage(false)).toContain('1 000 ₽ / месяц');
    expect(productSelectionMessage(true, true)).toContain('1 000 ₽ / 30 дней');
  });
  it('shows terms and a direct payment URL without another checkout callback', () => {
    const product = getProduct('monthly')!;
    const keyboard = productKeyboard('monthly', 'https://auth.robokassa.ru/Merchant/Index.aspx', {
      OFFER_URL: 'https://example.org/offer',
      PRIVACY_URL: 'https://example.org/privacy',
    } as AppConfig);
    const buttons = keyboard.inline_keyboard.flat();
    expect(productMessage(product)).toContain('публичной офертой');
    expect(buttons[0]).toMatchObject({
      text: '💳 Перейти к оплате',
      url: 'https://auth.robokassa.ru/Merchant/Index.aspx',
    });
    expect(
      buttons.some(
        (button) => 'callback_data' in button && button.callback_data?.startsWith('checkout:'),
      ),
    ).toBe(false);
    expect(buttons.some((button) => button.text === '📄 Оферта')).toBe(true);
    expect(buttons.some((button) => button.text === '🔐 Политика')).toBe(true);
  });
});
