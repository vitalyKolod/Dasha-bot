import { describe, expect, it, vi } from 'vitest';
import { calculateNewExpiry } from '../src/modules/subscriptions/subscription.logic.js';
import { SubscriptionService } from '../src/modules/subscriptions/subscription.service.js';
import type { SubscriptionRepository } from '../src/modules/subscriptions/subscription.repository.js';
import type { PaymentDocument } from '../src/modules/payments/payment.model.js';

const day = 86_400_000;
describe('calculateNewExpiry', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  it('creates a new subscription from now', () =>
    expect(calculateNewExpiry(now, undefined, 30)?.getTime()).toBe(now.getTime() + 30 * day));
  it('extends an active subscription from existing expiry', () => {
    const current = new Date(now.getTime() + 10 * day);
    expect(calculateNewExpiry(now, current, 30)?.getTime()).toBe(current.getTime() + 30 * day);
  });
  it('renews an expired subscription from now', () => {
    const expired = new Date(now.getTime() - day);
    expect(calculateNewExpiry(now, expired, 30)?.getTime()).toBe(now.getTime() + 30 * day);
  });
  it('returns null for lifetime', () =>
    expect(calculateNewExpiry(now, undefined, null)).toBeNull());
});

it('honors a 90-day payment created before the tariff was removed', async () => {
  const upsert = vi.fn().mockImplementation((value: unknown) => Promise.resolve(value));
  const service = new SubscriptionService({
    findByTelegramId: vi.fn().mockResolvedValue(null),
    upsert,
  } as unknown as SubscriptionRepository);
  const started = Date.now();
  const result = await service.activate({
    telegramId: '42',
    productId: 'quarterly',
    userId: 'user-id',
    _id: 'payment-id',
  } as unknown as PaymentDocument);
  expect(result.productId).toBe('quarterly');
  expect(result.expiresAt?.getTime()).toBeGreaterThanOrEqual(started + 90 * day);
  expect(result.expiresAt?.getTime()).toBeLessThanOrEqual(Date.now() + 90 * day);
});
