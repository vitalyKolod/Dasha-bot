import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../context.js';
import { SubscriptionRepository } from '../../modules/subscriptions/subscription.repository.js';

export function registerAccessHandlers(
  bot: Bot<BotContext>,
  subscriptions = new SubscriptionRepository(),
): void {
  bot.on('chat_join_request', async (ctx) => {
    const request = ctx.chatJoinRequest;
    if (String(request.chat.id) !== ctx.config.PRIVATE_CLUB_CHAT_ID) return;
    const telegramId = String(request.from.id);
    const link = request.invite_link?.invite_link;
    const active = await ctx.services.subscriptions.getActive(telegramId);
    const assigned =
      !!link &&
      !!active &&
      (active.inviteLink === link ||
        (active.inviteLinks ?? []).some(
          (item) => item.url === link && item.expiresAt > new Date(),
        ));
    if (!assigned) {
      await ctx.api.declineChatJoinRequest(request.chat.id, request.from.id);
      ctx.logger.warn({ telegramId }, 'Unrecognized club join request declined');
      return;
    }
    await ctx.api.approveChatJoinRequest(request.chat.id, request.from.id);
    const consumed = await subscriptions.clearInvite(telegramId, link);
    const issuedLinks = new Set([link, ...(consumed?.inviteLinks ?? []).map((item) => item.url)]);
    for (const issuedLink of issuedLinks) {
      try {
        await ctx.api.revokeChatInviteLink(request.chat.id, issuedLink);
      } catch {
        ctx.logger.warn({ telegramId }, 'Used invite could not be revoked');
      }
    }
    try {
      const keyboard = new InlineKeyboard();
      const clubId = /^-100(\d+)$/.exec(ctx.config.PRIVATE_CLUB_CHAT_ID)?.[1];
      if (clubId) keyboard.url('🍳 Открыть клуб', `https://t.me/c/${clubId}/1`).row();
      keyboard.text('👤 Мой аккаунт', 'subscription');
      await ctx.api.sendMessage(
        request.from.id,
        '✅ Вход в закрытый клуб подтверждён. Приятного знакомства с материалами! 💛',
        { reply_markup: keyboard },
      );
    } catch {
      ctx.logger.warn({ telegramId }, 'Club access confirmation could not be sent');
    }
  });
}
