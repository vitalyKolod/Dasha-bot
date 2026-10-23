import { describe, expect, it, vi } from 'vitest';
import { registerAccessHandlers } from '../src/bot/handlers/access.handler.js';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import type { SubscriptionRepository } from '../src/modules/subscriptions/subscription.repository.js';

function setup(
  active: { inviteLink: string; inviteLinks?: { url: string; expiresAt: Date }[] } | null,
) {
  let handler: ((ctx: BotContext) => Promise<void>) | undefined;
  const on = vi.fn((_event: string, callback: (ctx: BotContext) => Promise<void>) => {
    handler = callback;
  });
  const clearInvite = vi.fn().mockResolvedValue(active);
  registerAccessHandlers(
    { on } as unknown as Bot<BotContext>,
    { clearInvite } as unknown as SubscriptionRepository,
  );
  const approveChatJoinRequest = vi.fn().mockResolvedValue(true);
  const declineChatJoinRequest = vi.fn().mockResolvedValue(true);
  const revokeChatInviteLink = vi.fn().mockResolvedValue({});
  const sendMessage = vi.fn().mockResolvedValue({});
  const ctx = {
    chatJoinRequest: {
      chat: { id: -1004334407084 },
      from: { id: 123 },
      invite_link: { invite_link: 'https://t.me/+paid' },
    },
    config: { PRIVATE_CLUB_CHAT_ID: '-1004334407084' },
    services: { subscriptions: { getActive: vi.fn().mockResolvedValue(active) } },
    api: { approveChatJoinRequest, declineChatJoinRequest, revokeChatInviteLink, sendMessage },
    logger: { warn: vi.fn() },
  } as unknown as BotContext;
  return {
    run: () => handler!(ctx),
    approveChatJoinRequest,
    declineChatJoinRequest,
    revokeChatInviteLink,
    sendMessage,
    clearInvite,
  };
}

describe('club join requests', () => {
  it('approves only the paying user and consumes the link', async () => {
    const {
      run,
      approveChatJoinRequest,
      declineChatJoinRequest,
      revokeChatInviteLink,
      clearInvite,
      sendMessage,
    } = setup({ inviteLink: 'https://t.me/+paid' });
    await run();
    expect(approveChatJoinRequest).toHaveBeenCalledWith(-1004334407084, 123);
    expect(clearInvite).toHaveBeenCalledWith('123', 'https://t.me/+paid');
    expect(revokeChatInviteLink).toHaveBeenCalledWith(-1004334407084, 'https://t.me/+paid');
    expect(declineChatJoinRequest).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Вход в закрытый клуб подтверждён'),
      expect.objectContaining({ reply_markup: expect.any(Object) as object }),
    );
  });
  it('declines a forwarded link used by another subscriber', async () => {
    const { run, approveChatJoinRequest, declineChatJoinRequest, clearInvite } = setup({
      inviteLink: 'https://t.me/+different',
    });
    await run();
    expect(declineChatJoinRequest).toHaveBeenCalledWith(-1004334407084, 123);
    expect(approveChatJoinRequest).not.toHaveBeenCalled();
    expect(clearInvite).not.toHaveBeenCalled();
  });
  it('approves an earlier unexpired link after refresh and revokes both links', async () => {
    const { run, approveChatJoinRequest, declineChatJoinRequest, revokeChatInviteLink } = setup({
      inviteLink: 'https://t.me/+new',
      inviteLinks: [
        { url: 'https://t.me/+paid', expiresAt: new Date(Date.now() + 3_600_000) },
        { url: 'https://t.me/+new', expiresAt: new Date(Date.now() + 3_600_000) },
      ],
    });
    await run();
    expect(approveChatJoinRequest).toHaveBeenCalledWith(-1004334407084, 123);
    expect(declineChatJoinRequest).not.toHaveBeenCalled();
    expect(revokeChatInviteLink).toHaveBeenCalledWith(-1004334407084, 'https://t.me/+paid');
    expect(revokeChatInviteLink).toHaveBeenCalledWith(-1004334407084, 'https://t.me/+new');
  });
});
