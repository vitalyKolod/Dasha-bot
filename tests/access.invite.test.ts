import { describe, expect, it, vi } from 'vitest';
import { AccessService } from '../src/modules/access/access.service.js';
import type { Api } from 'grammy';
import type { AppConfig } from '../src/config/env.js';
import type { Logger } from 'pino';
import type { SubscriptionDocument } from '../src/modules/subscriptions/subscription.model.js';

describe('invitation reuse', () => {
  it('reuses a still valid invitation on retry', async () => {
    const createChatInviteLink = vi.fn();
    const access = new AccessService(
      { createChatInviteLink } as unknown as Api,
      { PRIVATE_CLUB_CHAT_ID: '-100123', INVITE_LINK_TTL_HOURS: 24 } as AppConfig,
      { info: vi.fn() } as unknown as Logger,
    );
    const save = vi.fn();
    const subscription = {
      telegramId: '123',
      inviteLink: 'https://t.me/+existing',
      inviteLinkExpiresAt: new Date(Date.now() + 3_600_000),
      save,
    } as unknown as SubscriptionDocument;
    await expect(access.getOrCreateValidInvite(subscription)).resolves.toBe(
      'https://t.me/+existing',
    );
    expect(createChatInviteLink).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
