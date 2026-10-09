import type { Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { sendWelcome } from './menu.handler.js';
import { adminKeyboard } from '../ui/keyboards/admin.keyboard.js';
import { AdminDialogModel, MaterialModel } from '../../modules/admin/content.model.js';
import { deliverMaterial } from './admin/admin.handler.js';
import { InlineKeyboard } from 'grammy';
import { formatDate } from '../ui/helpers/formatDate.js';

export function registerStartHandler(bot: Bot<BotContext>): void {
  bot.command('start', async (ctx) => {
    if (!ctx.from) return;
    await ctx.services.users.touch(ctx.from);
    ctx.logger.info({ telegramId: ctx.from.id, username: ctx.from.username }, '👤 USER START');
    if (ctx.config.CHECKLIST_MODE && !ctx.config.adminIds.has(String(ctx.from.id))) {
      await sendWelcome(ctx);
      return;
    }
    const payload = ctx.match.trim();
    if (payload === 'payment_success') {
      await ctx.reply('⏳ Проверяем оплату. Подтверждение придёт сюда после обработки платежа.');
      return;
    }
    if (payload === 'payment_failed') {
      await ctx.reply('❌ Оплата не завершена. Вы можете выбрать тариф и попробовать снова.');
      return;
    }
    if (payload.startsWith('pay_') && /^[A-Za-z0-9_-]{40,100}$/.test(payload.slice(4))) {
      const payment = await ctx.services.payments.findByToken(payload.slice(4));
      if (!payment || payment.telegramId !== String(ctx.from.id)) {
        await ctx.reply('Ссылка недействительна или устарела.');
        return;
      }
      if (payment.status === 'succeeded') {
        await ctx.services.payments.processSuccess(String(payment._id));
        const subscription = await ctx.services.subscriptions.get(String(ctx.from.id));
        if (subscription) {
          const invite = await ctx.services.access.getOrCreateValidInvite(subscription);
          const keyboard = new InlineKeyboard();
          if (invite) keyboard.url('👉 Вступить в закрытый клуб', invite).row();
          keyboard.text('🏠 Главное меню', 'menu');
          await ctx.reply(
            `🎉 <b>Оплата прошла!</b>\n\nДобро пожаловать в клуб 💛\n\nТвой доступ активен: <b>${subscription.expiresAt ? `до ${formatDate(subscription.expiresAt)}` : 'навсегда'}</b>`,
            { parse_mode: 'HTML', reply_markup: keyboard },
          );
          return;
        }
      }
      const keyboard = new InlineKeyboard()
        .text('🔄 Проверить оплату', `check:${payment.publicId}`)
        .row()
        .text('🏠 Главное меню', 'menu');
      await ctx.reply(
        payment.status === 'canceled' ? '❌ Оплата не завершена' : '⏳ Оплата пока обрабатывается',
        { reply_markup: keyboard },
      );
      return;
    }
    if (payload && !payload.startsWith('pay_')) {
      const material = await MaterialModel.findOne({ code: payload });
      if (material || payload.startsWith('m_')) {
        await deliverMaterial(ctx, payload);
        return;
      }
    }
    if (ctx.config.adminIds.has(String(ctx.from.id))) {
      await AdminDialogModel.deleteOne({ adminId: String(ctx.from.id) });
      await ctx.reply('Привет, Даша! Выберите раздел админки:', {
        reply_markup: adminKeyboard(ctx.config.NODE_ENV !== 'production'),
      });
      return;
    }
    await sendWelcome(ctx);
  });
}
