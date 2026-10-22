import type { Bot } from 'grammy';
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
    if (!link || !active || active.inviteLink !== link) {
      await ctx.api.declineChatJoinRequest(request.chat.id, request.from.id);
      ctx.logger.warn({ telegramId }, 'Unrecognized club join request declined');
      return;
    }
    await ctx.api.approveChatJoinRequest(request.chat.id, request.from.id);
    await subscriptions.clearInvite(telegramId, link);
    try {
      await ctx.api.revokeChatInviteLink(request.chat.id, link);
    } catch (error) {
      ctx.logger.warn({ err: error, telegramId }, 'Used invite could not be revoked');
    }
  });
}
