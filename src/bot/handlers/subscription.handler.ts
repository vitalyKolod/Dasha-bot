import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { getProductById } from '../../config/products.js';
import { formatDate } from '../ui/helpers/formatDate.js';
import { renderScreen } from '../ui/renderScreen.js';
import { addPaymentSupportButton } from '../ui/paymentSupport.js';
import { ClubAccessBlockedError } from '../../modules/access/access.service.js';

export async function showAccount(
  ctx: BotContext,
  refreshInvite = false,
  newMessage = false,
): Promise<void> {
  if (!ctx.from) return;
  const subscription = await ctx.services.subscriptions.getActive(String(ctx.from.id));
  if (!subscription) {
    await renderScreen(
      ctx,
      {
        text: '👤 <b>Мой аккаунт</b>\n\nАктивного доступа сейчас нет.',
        keyboard: new InlineKeyboard()
          .text('🍳 Посмотреть тарифы', 'products')
          .row()
          .text('← Назад', 'menu'),
      },
      newMessage,
    );
    return;
  }

  let access;
  let blocked = false;
  try {
    access = await ctx.services.access.getClubAccess(subscription, refreshInvite);
  } catch (error) {
    blocked = error instanceof ClubAccessBlockedError;
    ctx.logger.warn({ telegramId: ctx.from.id }, 'Club access could not be checked');
  }
  const product = getProductById(subscription.productId);
  const keyboard = new InlineKeyboard();
  if (access?.member) keyboard.url('🍳 Открыть клуб', access.url).row();
  else if (!blocked) keyboard.text('👉 Получить ссылку для входа', 'subscription:open').row();
  if (!access?.member && ctx.config.SUPPORT_USERNAME)
    addPaymentSupportButton(keyboard, ctx.config, '💬 Проблема со входом').row();
  keyboard.text('🔁 Продлить доступ', 'products').row();
  keyboard.text('🏠 Главное меню', 'menu');
  await renderScreen(
    ctx,
    {
      text: `👤 <b>Мой аккаунт</b>\n\n🟢 Доступ активен\n🍳 Тариф: <b>${product?.title ?? subscription.productId}</b>\n📅 Оплачено до: <b>${subscription.expiresAt ? formatDate(subscription.expiresAt) : 'навсегда'}</b>\n\n${access?.member ? '✅ Вы уже в закрытой группе.' : blocked ? '⚠️ Telegram не разрешает вход этому аккаунту: он заблокирован в группе. Напишите в поддержку, приложив чек об оплате.' : access ? '🔐 Нажмите кнопку ниже, чтобы получить актуальную ссылку. Заявку одобрит бот только для вашего аккаунта.' : 'Ссылка временно недоступна. Попробуйте получить её ещё раз или напишите в поддержку.'}`,
      keyboard,
    },
    newMessage,
  );
}

export async function showClubLink(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;
  const subscription = await ctx.services.subscriptions.getActive(String(ctx.from.id));
  if (!subscription) {
    await showAccount(ctx, false, true);
    return;
  }
  try {
    const access = await ctx.services.access.getClubAccess(subscription, true);
    if (!access) throw new Error('Club invitation unavailable');
    const keyboard = new InlineKeyboard()
      .url(access.member ? '🍳 Открыть клуб' : '👉 Вступить в закрытый клуб', access.url)
      .row()
      .text('🔄 Получить новую ссылку', 'subscription:open')
      .row()
      .text('👤 Мой аккаунт', 'subscription');
    await renderScreen(ctx, {
      text: access.member
        ? '✅ Вы уже в закрытой группе. Откройте её по кнопке ниже.'
        : '🔐 Ссылка готова. Нажмите «Вступить» и отправьте заявку. Бот одобрит только ваш аккаунт. Если Telegram покажет, что ссылка недействительна, нажмите «Получить новую ссылку».',
      keyboard,
    });
  } catch (error) {
    const blocked = error instanceof ClubAccessBlockedError;
    ctx.logger.warn(
      { telegramId: ctx.from.id, errorType: error instanceof Error ? error.name : 'unknown' },
      'Club link could not be issued',
    );
    await renderScreen(ctx, {
      text: blocked
        ? '⚠️ Telegram не разрешает вход этому аккаунту: он заблокирован в группе. Если вы оплатили доступ, отправьте чек в поддержку.'
        : '⚠️ Не удалось получить ссылку из Telegram. Попробуйте ещё раз через несколько секунд. Если вы оплатили доступ, отправьте чек в поддержку.',
      keyboard: addPaymentSupportButton(
        new InlineKeyboard().text('🔄 Повторить', 'subscription:open').row(),
        ctx.config,
      ),
    });
  }
}

export function registerSubscriptionHandler(bot: Bot<BotContext>): void {
  bot.callbackQuery('subscription', async (ctx) => showAccount(ctx));
  bot.callbackQuery('receipt:subscription', async (ctx) => showAccount(ctx, false, true));
  bot.callbackQuery('subscription:refresh', async (ctx) => showAccount(ctx, true));
  bot.callbackQuery('subscription:open', showClubLink);
  bot.callbackQuery('receipt:club', showClubLink);
}
