import { describe, expect, it, vi } from 'vitest';
import { PaymentDeliveryService } from '../src/modules/payments/paymentDelivery.service.js';
import type { PaymentRepository } from '../src/modules/payments/payment.repository.js';
import type { SubscriptionService } from '../src/modules/subscriptions/subscription.service.js';
import type { AccessService } from '../src/modules/access/access.service.js';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import type { Logger } from 'pino';

function setup(fails: boolean, purpose: 'new_subscription' | 'renewal' = 'new_subscription') {
  const payment = {
    _id: 'payment',
    telegramId: '123',
    publicId: 'public',
    deliveryAttempts: 1,
    purpose,
  };
  const claimDelivery = vi.fn().mockResolvedValueOnce(payment).mockResolvedValue(null);
  const markDelivered = vi.fn();
  const retryDelivery = vi.fn();
  const sendMessage = fails
    ? vi.fn().mockRejectedValue(new Error('Telegram unavailable'))
    : vi.fn().mockResolvedValue({});
  const getClubAccess = vi.fn().mockResolvedValue({ url: 'https://t.me/+invite', member: false });
  const worker = new PaymentDeliveryService(
    { api: { sendMessage } } as unknown as Bot<BotContext>,
    { getClubAccess } as unknown as AccessService,
    { warn: vi.fn(), error: vi.fn() } as unknown as Logger,
    { claimDelivery, markDelivered, retryDelivery } as unknown as PaymentRepository,
    {
      getActive: vi.fn().mockResolvedValue({ expiresAt: new Date('2026-11-22') }),
    } as unknown as SubscriptionService,
  );
  return { worker, markDelivered, retryDelivery, sendMessage, getClubAccess };
}

describe('paid invitation delivery', () => {
  it('records successful delivery', async () => {
    const { worker, markDelivered, retryDelivery, sendMessage } = setup(false);
    await worker.runOnce();
    expect(sendMessage).toHaveBeenCalledOnce();
    const options = (sendMessage.mock.calls[0] as unknown[])[2] as {
      reply_markup: { inline_keyboard: { callback_data?: string }[][] };
    };
    expect(options.reply_markup.inline_keyboard.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ callback_data: 'receipt:club' }),
        expect.objectContaining({ callback_data: 'receipt:subscription' }),
        expect.objectContaining({ callback_data: 'receipt:menu' }),
      ]),
    );
    expect(markDelivered).toHaveBeenCalledWith('payment');
    expect(retryDelivery).not.toHaveBeenCalled();
  });
  it('keeps a failed Telegram delivery for retry', async () => {
    const { worker, markDelivered, retryDelivery } = setup(true);
    await worker.runOnce();
    expect(markDelivered).not.toHaveBeenCalled();
    expect(retryDelivery).toHaveBeenCalledWith('payment', 1);
  });
  it('confirms the new end date and 1,000 ₽ price after a renewal', async () => {
    const { worker, sendMessage } = setup(false, 'renewal');
    await worker.runOnce();
    const text = (sendMessage.mock.calls[0] as unknown[])[1] as string;
    expect(text).toContain('Доступ продлён до');
    expect(text).toContain('1 000 ₽');
    expect(text).toContain('Автоматического списания нет');
  });
});
