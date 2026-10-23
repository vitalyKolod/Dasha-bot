import type { InlineKeyboard } from 'grammy';
import type { AppConfig } from '../../config/env.js';

type SupportConfig = Pick<AppConfig, 'SUPPORT_USERNAME'>;

export function paymentSupportHint(config: SupportConfig): string {
  const username = config.SUPPORT_USERNAME?.replace(/^@/, '');
  const contact = username ? `@${username}` : 'поддержку';
  return `Если деньги списались, а доступ не появился, не оплачивайте повторно. Отправьте чек или скриншот оплаты в ${contact}.`;
}

export function addPaymentSupportButton(
  keyboard: InlineKeyboard,
  config: SupportConfig,
  label = '💬 Помощь с оплатой',
): InlineKeyboard {
  const username = config.SUPPORT_USERNAME?.replace(/^@/, '');
  if (username) {
    const rows = keyboard.inline_keyboard;
    if (rows.length && rows[rows.length - 1]!.length) keyboard.row();
    keyboard.url(label, `https://t.me/${username}`);
  }
  return keyboard;
}
