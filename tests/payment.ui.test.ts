import { describe, expect, it } from 'vitest';
import { productKeyboard } from '../src/bot/ui/keyboards/products.keyboard.js';
import { productMessage } from '../src/bot/ui/messages/payment.message.js';
import { getProduct } from '../src/config/products.js';
import type { AppConfig } from '../src/config/env.js';

describe('product checkout screen', () => {
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
