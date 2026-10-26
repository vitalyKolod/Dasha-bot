import { describe, expect, it, vi } from 'vitest';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import type { AccessService } from '../src/modules/access/access.service.js';
import { ReminderService } from '../src/modules/reminders/reminder.service.js';
import type { SubscriptionRepository } from '../src/modules/subscriptions/subscription.repository.js';
import type { Logger } from 'pino';

const now = new Date('2026-10-26T12:00:00Z');

function setup(fails = false) {
  const items = [3, 2, 1, 0].map((days) => ({
    _id: String(days),
    telegramId: String(100 + days),
    expiresAt: new Date(now.getTime() + days * 86_400_000 + 6 * 3_600_000),
  }));
  const sendMessage = fails
    ? vi.fn().mockRejectedValue(new Error('Telegram unavailable'))
    : vi.fn().mockResolvedValue({});
  const claimReminder = vi
    .fn()
    .mockImplementation((id: string) => Promise.resolve(items.find((item) => item._id === id)));
  const releaseReminder = vi.fn().mockResolvedValue({});
  const reminders = new ReminderService(
    { api: { sendMessage } } as unknown as Bot<BotContext>,
    {} as AccessService,
    { info: vi.fn(), warn: vi.fn() } as unknown as Logger,
    {
      listActiveExpiringBetween: vi.fn().mockResolvedValue(items),
      claimReminder,
      releaseReminder,
      listDueForExpiration: vi.fn().mockResolvedValue([]),
      listExpiredNeedingRemoval: vi.fn().mockResolvedValue([]),
    } as unknown as SubscriptionRepository,
  );
  return { reminders, items, sendMessage, claimReminder, releaseReminder };
}

describe('expiration reminders', () => {
  it('sends separate reminders at 3, 2, 1 and 0 Moscow calendar days', async () => {
    const { reminders, items, sendMessage, claimReminder } = setup();
    await reminders.run(now);
    expect(sendMessage).toHaveBeenCalledTimes(4);
    expect(claimReminder.mock.calls.map((call) => call[1] as string)).toEqual([
      'reminder3DaysSentAt',
      'reminder2DaysSentAt',
      'reminder1DaySentAt',
      'reminderTodaySentAt',
    ]);
    for (const [index, phrase] of ['через 3 дня', 'послезавтра', 'завтра', 'сегодня'].entries()) {
      const call = sendMessage.mock.calls[index] as unknown[];
      expect(call[0]).toBe(Number(items[index]!.telegramId));
      expect(call[1]).toContain(phrase);
      expect(call[1]).toContain('1 000 ₽');
      expect(
        (
          call[2] as { reply_markup: { inline_keyboard: { callback_data: string }[][] } }
        ).reply_markup.inline_keyboard.flat()[0]?.callback_data,
      ).toBe('reminder:renew');
    }
  });

  it('releases a reminder after failed Telegram delivery for the next scheduled attempt', async () => {
    const { reminders, items, releaseReminder } = setup(true);
    await reminders.run(now);
    expect(releaseReminder).toHaveBeenCalledWith('3', 'reminder3DaysSentAt', items[0]!.expiresAt);
    expect(releaseReminder).toHaveBeenCalledTimes(4);
  });
});
