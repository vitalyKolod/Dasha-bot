import { describe, expect, it, vi } from 'vitest';
import { AccessService } from '../src/modules/access/access.service.js';
import type { Api } from 'grammy';
import type { AppConfig } from '../src/config/env.js';
import type { Logger } from 'pino';
import type { SubscriptionDocument } from '../src/modules/subscriptions/subscription.model.js';
import type { SubscriptionRepository } from '../src/modules/subscriptions/subscription.repository.js';

describe('invitation reuse', () => {
  it('reuses a still valid invitation on retry', async () => {
    const createChatInviteLink = vi.fn();
    const save = vi.fn();
    const subscription = {
      telegramId: '123',
      inviteLink: 'https://t.me/+existing',
      inviteRequiresApproval: true,
      inviteLinkExpiresAt: new Date(Date.now() + 3_600_000),
      save,
    } as unknown as SubscriptionDocument;
    const access = new AccessService(
      { createChatInviteLink } as unknown as Api,
      { PRIVATE_CLUB_CHAT_ID: '-100123', INVITE_LINK_TTL_HOURS: 24 } as AppConfig,
      { info: vi.fn() } as unknown as Logger,
      {
        findByTelegramId: vi.fn().mockResolvedValue(subscription),
      } as unknown as SubscriptionRepository,
    );
    await expect(access.getOrCreateValidInvite(subscription)).resolves.toBe(
      'https://t.me/+existing',
    );
    expect(createChatInviteLink).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
  it('opens the private club directly for a member without sharing an invite', async () => {
    const getChatMember = vi.fn().mockResolvedValue({ status: 'member' });
    const createChatInviteLink = vi.fn();
    const subscription = { telegramId: '123' } as SubscriptionDocument;
    const access = new AccessService(
      { getChatMember, createChatInviteLink } as unknown as Api,
      { PRIVATE_CLUB_CHAT_ID: '-1004334407084' } as AppConfig,
      {} as Logger,
    );
    await expect(access.getClubAccess(subscription)).resolves.toEqual({
      url: 'https://t.me/c/4334407084/1',
      member: true,
    });
    expect(createChatInviteLink).not.toHaveBeenCalled();
  });
  it('offers an approval-only invite to an active buyer outside the club', async () => {
    const subscription = {
      telegramId: '123',
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as SubscriptionDocument;
    const createChatInviteLink = vi.fn().mockResolvedValue({ invite_link: 'https://t.me/+new' });
    const access = new AccessService(
      {
        getChatMember: vi.fn().mockResolvedValue({ status: 'left' }),
        createChatInviteLink,
      } as unknown as Api,
      { PRIVATE_CLUB_CHAT_ID: '-1004334407084', INVITE_LINK_TTL_HOURS: 24 } as AppConfig,
      { info: vi.fn() } as unknown as Logger,
      {
        findByTelegramId: vi.fn().mockResolvedValue(subscription),
      } as unknown as SubscriptionRepository,
    );
    await expect(access.getClubAccess(subscription)).resolves.toEqual({
      url: 'https://t.me/+new',
      member: false,
    });
    expect(createChatInviteLink).toHaveBeenCalledWith(
      '-1004334407084',
      expect.objectContaining({ creates_join_request: true }),
      expect.anything(),
    );
  });
  it('creates only one approval invite for concurrent delivery and account requests', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const subscription = { telegramId: '123', save } as unknown as SubscriptionDocument;
    const createChatInviteLink = vi.fn().mockResolvedValue({ invite_link: 'https://t.me/+new' });
    const access = new AccessService(
      { createChatInviteLink } as unknown as Api,
      { PRIVATE_CLUB_CHAT_ID: '-1004334407084', INVITE_LINK_TTL_HOURS: 24 } as AppConfig,
      { info: vi.fn() } as unknown as Logger,
      {
        findByTelegramId: vi.fn().mockResolvedValue(subscription),
      } as unknown as SubscriptionRepository,
    );
    const links = await Promise.all([
      access.getOrCreateValidInvite(subscription),
      access.getOrCreateValidInvite(subscription),
    ]);
    expect(links).toEqual(['https://t.me/+new', 'https://t.me/+new']);
    expect(createChatInviteLink).toHaveBeenCalledOnce();
    expect(createChatInviteLink).toHaveBeenCalledWith(
      '-1004334407084',
      expect.objectContaining({ creates_join_request: true }),
      expect.anything(),
    );
  });
  it('replaces a reported bad link and revokes the previous one', async () => {
    const subscription = {
      telegramId: '123',
      inviteLink: 'https://t.me/+old',
      inviteRequiresApproval: true,
      inviteLinkExpiresAt: new Date(Date.now() + 3_600_000),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as SubscriptionDocument;
    const revokeChatInviteLink = vi.fn().mockResolvedValue({});
    const access = new AccessService(
      {
        createChatInviteLink: vi.fn().mockResolvedValue({ invite_link: 'https://t.me/+new' }),
        revokeChatInviteLink,
      } as unknown as Api,
      { PRIVATE_CLUB_CHAT_ID: '-1004334407084', INVITE_LINK_TTL_HOURS: 24 } as AppConfig,
      { info: vi.fn() } as unknown as Logger,
      {
        findByTelegramId: vi.fn().mockResolvedValue(subscription),
      } as unknown as SubscriptionRepository,
    );
    await expect(access.getOrCreateValidInvite(subscription, true)).resolves.toBe(
      'https://t.me/+new',
    );
    expect(revokeChatInviteLink).toHaveBeenCalledWith('-1004334407084', 'https://t.me/+old');
  });
});
