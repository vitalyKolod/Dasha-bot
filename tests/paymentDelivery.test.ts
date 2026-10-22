import { describe, expect, it, vi } from 'vitest';
import { PaymentDeliveryService } from '../src/modules/payments/paymentDelivery.service.js';
import type { PaymentRepository } from '../src/modules/payments/payment.repository.js';
import type { SubscriptionService } from '../src/modules/subscriptions/subscription.service.js';
import type { AccessService } from '../src/modules/access/access.service.js';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import type { Logger } from 'pino';

function setup(fails: boolean) {
  const payment = { _id: 'payment', telegramId: '123', publicId: 'public', deliveryAttempts: 1 };
  const claimDelivery = vi.fn().mockResolvedValueOnce(payment).mockResolvedValue(null);
  const markDelivered = vi.fn();
  const retryDelivery = vi.fn();
  const sendMessage = fails
    ? vi.fn().mockRejectedValue(new Error('Telegram unavailable'))
    : vi.fn().mockResolvedValue({});
  const getOrCreateValidInvite = vi.fn().mockResolvedValue('https://t.me/+invite');
  const worker = new PaymentDeliveryService(
    { api: { sendMessage } } as unknown as Bot<BotContext>,
    { getOrCreateValidInvite } as unknown as AccessService,
    { warn: vi.fn(), error: vi.fn() } as unknown as Logger,
    { claimDelivery, markDelivered, retryDelivery } as unknown as PaymentRepository,
    {
      get: vi.fn().mockResolvedValue({ expiresAt: new Date('2026-11-22') }),
    } as unknown as SubscriptionService,
  );
  return { worker, markDelivered, retryDelivery, sendMessage, getOrCreateValidInvite };
}

describe('paid invitation delivery', () => {
  it('records successful delivery', async () => {
    const { worker, markDelivered, retryDelivery, sendMessage } = setup(false);
    await worker.runOnce();
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(markDelivered).toHaveBeenCalledWith('payment');
    expect(retryDelivery).not.toHaveBeenCalled();
  });
  it('keeps a failed Telegram delivery for retry', async () => {
    const { worker, markDelivered, retryDelivery } = setup(true);
    await worker.runOnce();
    expect(markDelivered).not.toHaveBeenCalled();
    expect(retryDelivery).toHaveBeenCalledWith('payment', 1);
  });
});
