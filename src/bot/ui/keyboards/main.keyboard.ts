import { InlineKeyboard } from 'grammy';
import type { AppConfig } from '../../../config/env.js';
export function mainKeyboard(active: boolean, config: AppConfig) {
  const keyboard = new InlineKeyboard();
  if (active) keyboard.text('👤 Мой аккаунт', 'subscription').row();
  else
    keyboard
      .text(
        config.PRE_REGISTRATION ? '❤️ ЖДУ ОТКРЫТИЯ' : '🔍 Вступить в клуб',
        config.PRE_REGISTRATION ? 'waitlist' : 'products',
      )
      .row();
  keyboard.text('✨ Что внутри', 'inside').row();
  keyboard.text('📄 Информация и условия', 'legal').row();
  if (config.SUPPORT_USERNAME)
    keyboard.url('💬 Задать вопрос', `https://t.me/${config.SUPPORT_USERNAME.replace(/^@/, '')}`);
  return keyboard;
}
