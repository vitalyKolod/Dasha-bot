import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../src/modules/users/user.model.js';
import { PaymentModel } from '../src/modules/payments/payment.model.js';
import { SubscriptionModel } from '../src/modules/subscriptions/subscription.model.js';
import { audienceIds } from '../src/modules/admin/audience.js';

describe('admin audiences', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(UserModel, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ telegramId: '1' }, { telegramId: '2' }]),
    } as never);
  });
  it('includes users with no succeeded payment only in unpaid', async () => {
    vi.spyOn(PaymentModel, 'distinct').mockResolvedValue(['2'] as never);
    expect(await audienceIds('unpaid', 3)).toEqual(['1']);
    expect(await audienceIds('started', 3)).toEqual(['1', '2']);
  });
  it('uses real subscription status and a configurable upcoming window', async () => {
    const distinct = vi.spyOn(SubscriptionModel, 'distinct').mockResolvedValue(['2'] as never);
    const now = new Date('2026-09-25T00:00:00Z');
    expect(await audienceIds('expiring', 5, now)).toEqual(['2']);
    expect(distinct).toHaveBeenCalledWith('telegramId', {
      telegramId: { $in: ['1', '2'] },
      status: 'active',
      expiresAt: { $gt: now, $lte: new Date('2026-09-30T00:00:00Z') },
    });
  });
});
