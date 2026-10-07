import { InlineKeyboard } from 'grammy';
import type { AppConfig } from '../../../config/env.js';
export function mainKeyboard(active: boolean, config: AppConfig, invite?: string) {
  const keyboard = new InlineKeyboard();
  if (active && invite) keyboard.url('🍳 Перейти в клуб', invite).row();
  else keyboard.text('🔍 Вступить в клуб', 'products').row();
  if (active)
    keyboard.text('✅ Моя подписка', 'subscription').text('💳 Продлить доступ', 'products').row();
  else keyboard.text('✨ Что внутри', 'inside').row();
  if (config.SUPPORT_USERNAME)
    keyboard.url('💬 Задать вопрос', `https://t.me/${config.SUPPORT_USERNAME.replace(/^@/, '')}`);
  return keyboard;
}
