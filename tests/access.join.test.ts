import { describe, expect, it, vi } from 'vitest';
import { registerAccessHandlers } from '../src/bot/handlers/access.handler.js';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import type { SubscriptionRepository } from '../src/modules/subscriptions/subscription.repository.js';

function setup(active: { inviteLink: string } | null) {
  let handler: ((ctx: BotContext) => Promise<void>) | undefined;
  const on = vi.fn((_event: string, callback: (ctx: BotContext) => Promise<void>) => {
    handler = callback;
  });
  const clearInvite = vi.fn().mockResolvedValue(undefined);
  registerAccessHandlers(
    { on } as unknown as Bot<BotContext>,
    { clearInvite } as unknown as SubscriptionRepository,
  );
  const approveChatJoinRequest = vi.fn().mockResolvedValue(true);
  const declineChatJoinRequest = vi.fn().mockResolvedValue(true);
  const revokeChatInviteLink = vi.fn().mockResolvedValue({});
  const ctx = {
    chatJoinRequest: {
      chat: { id: -1004334407084 },
      from: { id: 123 },
      invite_link: { invite_link: 'https://t.me/+paid' },
    },
    config: { PRIVATE_CLUB_CHAT_ID: '-1004334407084' },
    services: { subscriptions: { getActive: vi.fn().mockResolvedValue(active) } },
    api: { approveChatJoinRequest, declineChatJoinRequest, revokeChatInviteLink },
    logger: { warn: vi.fn() },
  } as unknown as BotContext;
  return {
    run: () => handler!(ctx),
    approveChatJoinRequest,
    declineChatJoinRequest,
    revokeChatInviteLink,
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
    } = setup({ inviteLink: 'https://t.me/+paid' });
    await run();
    expect(approveChatJoinRequest).toHaveBeenCalledWith(-1004334407084, 123);
    expect(clearInvite).toHaveBeenCalledWith('123', 'https://t.me/+paid');
    expect(revokeChatInviteLink).toHaveBeenCalledWith(-1004334407084, 'https://t.me/+paid');
    expect(declineChatJoinRequest).not.toHaveBeenCalled();
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
});
