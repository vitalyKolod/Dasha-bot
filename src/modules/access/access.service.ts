import type { Api, Bot } from 'grammy';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env.js';
import type { SubscriptionDocument } from '../subscriptions/subscription.model.js';
import type { BotContext } from '../../bot/context.js';

export class AccessService {
  constructor(
    private readonly api: Api,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}
  async getOrCreateValidInvite(subscription: SubscriptionDocument): Promise<string | undefined> {
    if (!this.config.PRIVATE_CLUB_CHAT_ID) return undefined;
    if (
      subscription.inviteLink &&
      subscription.inviteRequiresApproval &&
      subscription.inviteLinkExpiresAt &&
      subscription.inviteLinkExpiresAt > new Date(Date.now() + 60_000)
    )
      return subscription.inviteLink;
    if (subscription.inviteLink && !subscription.inviteRequiresApproval) {
      try {
        await this.api.revokeChatInviteLink(
          this.config.PRIVATE_CLUB_CHAT_ID,
          subscription.inviteLink,
        );
      } catch (error) {
        this.logger.warn({ err: error }, 'Legacy invite could not be revoked');
      }
    }
    const expiresAt = new Date(Date.now() + this.config.INVITE_LINK_TTL_HOURS * 3_600_000);
    const link = await this.api.createChatInviteLink(
      this.config.PRIVATE_CLUB_CHAT_ID,
      {
        creates_join_request: true,
        expire_date: Math.floor(expiresAt.getTime() / 1000),
        name: `user-${subscription.telegramId}`,
      },
      AbortSignal.timeout(12_000) as unknown as Parameters<Api['createChatInviteLink']>[2],
    );
    subscription.inviteLink = link.invite_link;
    subscription.inviteRequiresApproval = true;
    subscription.inviteLinkExpiresAt = expiresAt;
    await subscription.save();
    this.logger.info({ telegramId: subscription.telegramId }, '🔗 INVITE LINK CREATED');
    return link.invite_link;
  }
  async removeFromClub(telegramId: string): Promise<boolean> {
    if (!this.config.PRIVATE_CLUB_CHAT_ID) return false;
    try {
      await this.api.banChatMember(this.config.PRIVATE_CLUB_CHAT_ID, Number(telegramId));
      await this.api.unbanChatMember(this.config.PRIVATE_CLUB_CHAT_ID, Number(telegramId), {
        only_if_banned: true,
      });
      this.logger.info({ telegramId }, '👢 USER REMOVED FROM CLUB');
      return true;
    } catch (error) {
      this.logger.warn({ err: error, telegramId }, 'Could not remove user from club');
      return false;
    }
  }
}

export const createAccessService = (bot: Bot<BotContext>, config: AppConfig, logger: Logger) =>
  new AccessService(bot.api, config, logger);
