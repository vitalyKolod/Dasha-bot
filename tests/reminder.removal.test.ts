import { describe, expect, it, vi } from 'vitest';
import { ReminderService } from '../src/modules/reminders/reminder.service.js';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import type { AccessService } from '../src/modules/access/access.service.js';
import type { SubscriptionRepository } from '../src/modules/subscriptions/subscription.repository.js';
import type { Logger } from 'pino';

describe('expired club access', () => {
  it('retries removal after a Telegram failure', async () => {
    const expired = { _id: 'sub', telegramId: '123' };
    const removeFromClub = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const markAccessRemoved = vi.fn();
    const markAccessRemovalPending = vi.fn().mockResolvedValue(expired);
    const reminders = new ReminderService(
      {} as Bot<BotContext>,
      { removeFromClub } as unknown as AccessService,
      { info: vi.fn() } as unknown as Logger,
      {
        listActiveExpiringBetween: vi.fn().mockResolvedValue([]),
        listDueForExpiration: vi.fn().mockResolvedValue([]),
        listExpiredNeedingRemoval: vi.fn().mockResolvedValue([expired]),
        markAccessRemovalPending,
        markAccessRemoved,
      } as unknown as SubscriptionRepository,
    );
    await reminders.run();
    expect(markAccessRemoved).not.toHaveBeenCalled();
    await reminders.run();
    expect(markAccessRemoved).toHaveBeenCalledWith('sub');
    expect(removeFromClub).toHaveBeenCalledTimes(2);
    expect(markAccessRemovalPending).toHaveBeenCalledTimes(2);
  });
});
