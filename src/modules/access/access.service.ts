import type { Api, Bot } from 'grammy';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env.js';
import type { SubscriptionDocument } from '../subscriptions/subscription.model.js';
import { SubscriptionRepository } from '../subscriptions/subscription.repository.js';
import type { BotContext } from '../../bot/context.js';

export interface ClubAccess {
  url: string;
  member: boolean;
}

export class AccessService {
  private readonly pendingInvites = new Map<string, Promise<string | undefined>>();
  constructor(
    private readonly api: Api,
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly subscriptions = new SubscriptionRepository(),
  ) {}

  async getClubAccess(
    subscription: SubscriptionDocument,
    refreshInvite = false,
  ): Promise<ClubAccess | undefined> {
    if (!this.config.PRIVATE_CLUB_CHAT_ID) return undefined;
    const member = await this.api.getChatMember(
      this.config.PRIVATE_CLUB_CHAT_ID,
      Number(subscription.telegramId),
      AbortSignal.timeout(12_000) as unknown as Parameters<Api['getChatMember']>[2],
    );
    const isMember =
      member.status === 'creator' ||
      member.status === 'administrator' ||
      member.status === 'member' ||
      (member.status === 'restricted' && member.is_member);
    if (isMember && /^-100\d+$/.test(this.config.PRIVATE_CLUB_CHAT_ID))
      return { url: `https://t.me/c/${this.config.PRIVATE_CLUB_CHAT_ID.slice(4)}/1`, member: true };
    const url = await this.getOrCreateValidInvite(subscription, refreshInvite);
    return url ? { url, member: false } : undefined;
  }

  async getOrCreateValidInvite(
    subscription: SubscriptionDocument,
    refresh = false,
  ): Promise<string | undefined> {
    if (!this.config.PRIVATE_CLUB_CHAT_ID) return undefined;
    const pending = this.pendingInvites.get(subscription.telegramId);
    if (pending) return pending;
    const task = this.createInvite(subscription, refresh);
    this.pendingInvites.set(subscription.telegramId, task);
    try {
      return await task;
    } finally {
      if (this.pendingInvites.get(subscription.telegramId) === task)
        this.pendingInvites.delete(subscription.telegramId);
    }
  }

  private async createInvite(subscription: SubscriptionDocument, refresh: boolean) {
    const current =
      (await this.subscriptions.findByTelegramId(subscription.telegramId)) ?? subscription;
    if (
      !refresh &&
      current.inviteLink &&
      current.inviteRequiresApproval &&
      current.inviteLinkExpiresAt &&
      current.inviteLinkExpiresAt > new Date(Date.now() + 60_000)
    )
      return current.inviteLink;
    const now = new Date();
    const previousLinks = (current.inviteLinks ?? []).filter((item) => item.expiresAt > now);
    if (
      current.inviteLink &&
      current.inviteRequiresApproval &&
      current.inviteLinkExpiresAt &&
      current.inviteLinkExpiresAt > now &&
      !previousLinks.some((item) => item.url === current.inviteLink)
    ) {
      previousLinks.push({ url: current.inviteLink, expiresAt: current.inviteLinkExpiresAt });
    }
    const expiresAt = new Date(Date.now() + this.config.INVITE_LINK_TTL_HOURS * 3_600_000);
    const link = await this.api.createChatInviteLink(
      this.config.PRIVATE_CLUB_CHAT_ID!,
      {
        creates_join_request: true,
        expire_date: Math.floor(expiresAt.getTime() / 1000),
        name: `user-${current.telegramId}`,
      },
      AbortSignal.timeout(12_000) as unknown as Parameters<Api['createChatInviteLink']>[2],
    );
    current.inviteLink = link.invite_link;
    current.inviteRequiresApproval = true;
    current.inviteLinkExpiresAt = expiresAt;
    current.inviteLinks = [...previousLinks, { url: link.invite_link, expiresAt }];
    try {
      await current.save();
    } catch (error) {
      await this.api.revokeChatInviteLink(this.config.PRIVATE_CLUB_CHAT_ID!, link.invite_link);
      throw error;
    }
    this.logger.info({ telegramId: current.telegramId }, '🔗 INVITE LINK CREATED');
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
