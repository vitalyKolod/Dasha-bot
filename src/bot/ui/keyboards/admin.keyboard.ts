import { InlineKeyboard } from 'grammy';
export const adminKeyboard = (development: boolean) => {
  const kb = new InlineKeyboard()
    .text('📊 Обзор', 'admin:stats')
    .row()
    .text('👥 Пользователи', 'admin:users')
    .row()
    .text('🎁 Материалы и ссылки', 'admin:materials')
    .row()
    .text('📣 Рассылки', 'admin:broadcast');
  if (development) kb.row().text('🧪 Dev payments', 'admin:dev');
  return kb;
};
export const adminBackKeyboard = () => new InlineKeyboard().text('← Назад', 'admin:menu');
