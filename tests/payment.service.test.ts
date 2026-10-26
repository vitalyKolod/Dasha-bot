import { describe, expect, it, vi } from 'vitest';
import { PaymentService } from '../src/modules/payments/payment.service.js';
import type { PaymentRepository } from '../src/modules/payments/payment.repository.js';
import type { PaymentProvider } from '../src/modules/payments/PaymentProvider.js';
import type { SubscriptionService } from '../src/modules/subscriptions/subscription.service.js';
import type { AppConfig } from '../src/config/env.js';
import type { Logger } from 'pino';
import { Types } from 'mongoose';
import { PaymentModel } from '../src/modules/payments/payment.model.js';

const event = { invoiceId: '42', amount: 99000, status: 'succeeded' as const, metadata: {} };
function service(payment: Record<string, unknown>) {
  const findByInvoice = vi.fn().mockResolvedValue(payment);
  const process = new PaymentService(
    { name: 'robokassa' } as PaymentProvider,
    { PAYMENT_RETURN_TOKEN_TTL_MINUTES: 60 } as AppConfig,
    { warn: vi.fn() } as unknown as Logger,
    { findByInvoice } as unknown as PaymentRepository,
    {} as SubscriptionService,
  );
  return { process, findByInvoice };
}

describe('verified payment checks', () => {
  it('rejects a test callback for a live order', async () => {
    const { process } = service({
      _id: 'id',
      amount: 99000,
      status: 'pending',
      testMode: false,
    });
    await expect(
      process.handleVerifiedEvent({ ...event, metadata: { testMode: true } }),
    ).rejects.toThrow('Payment mode mismatch');
  });
  it('rejects an amount different from the stored order', async () => {
    const { process } = service({ _id: 'id', amount: 99000, status: 'pending' });
    await expect(process.handleVerifiedEvent({ ...event, amount: 100 })).rejects.toThrow(
      'Payment amount mismatch',
    );
  });
  it('does not reactivate an already processed order', async () => {
    const { process } = service({
      _id: 'id',
      amount: 99000,
      status: 'succeeded',
      processedAt: new Date(),
    });
    await expect(process.handleVerifiedEvent(event)).resolves.toBeNull();
  });
  it('rejects an unknown invoice', async () => {
    const { process, findByInvoice } = service({});
    const missing = vi.spyOn(process, 'processSuccess');
    findByInvoice.mockResolvedValue(null);
    await expect(process.handleVerifiedEvent(event)).rejects.toThrow('Payment not found');
    expect(missing).not.toHaveBeenCalled();
  });
});

describe('payment return lookup', () => {
  it('does not reveal another user’s invoice', async () => {
    const { process } = service({ telegramId: '999', status: 'succeeded' });
    await expect(process.findReturnPayment('42', '123')).resolves.toBeNull();
  });
  it('reads a matching invoice without changing its status', async () => {
    const payment = { telegramId: '42', status: 'succeeded', processedAt: new Date() };
    const { process, findByInvoice } = service(payment);
    await expect(process.findReturnPayment('42', '123')).resolves.toBe(payment);
    expect(findByInvoice).toHaveBeenCalledWith('robokassa', '123');
  });
});

describe('checkout prices', () => {
  async function checkout(
    productId: string,
    paidBefore: boolean,
    testMode = true,
    livePilot = false,
    reusableCheckout: Record<string, unknown> | null = null,
  ) {
    const hasSucceededPayment = vi.fn().mockResolvedValue(paidBefore);
    const findReusableCheckout = vi.fn().mockResolvedValue(reusableCheckout);
    let created: Record<string, unknown> = {};
    const create = vi.fn((data: Record<string, unknown>) => {
      created = { ...data, _id: new Types.ObjectId() };
      return Promise.resolve(created);
    });
    const setCheckout = vi.fn((_id: string, checkoutUrl: string) =>
      Promise.resolve({ ...created, checkoutUrl }),
    );
    const providerCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: 'https://example.org/checkout',
      providerInvoiceId: '123',
    });
    const payments = {
      hasSucceededPayment,
      findReusableCheckout,
      create,
      setCheckout,
    } as unknown as PaymentRepository;
    const process = new PaymentService(
      { name: 'robokassa', createCheckout: providerCheckout } as unknown as PaymentProvider,
      {
        PAYMENT_PROVIDER: 'robokassa',
        ROBOKASSA_TEST_MODE: testMode,
        ROBOKASSA_LIVE_PILOT_ENABLED: livePilot,
        PAYMENT_RETURN_TOKEN_TTL_MINUTES: 60,
        PUBLIC_BASE_URL: 'https://pay.example.org',
        OFFER_VERSION: '1',
      } as AppConfig,
      { info: vi.fn() } as unknown as Logger,
      payments,
      {} as SubscriptionService,
    );
    vi.spyOn(process.returnTokens, 'create').mockResolvedValue('token');
    const result = await process.createCheckout({
      userId: new Types.ObjectId(),
      telegramId: '42',
      productId,
      ...(livePilot ? { livePilot: true } : {}),
    });
    return { created, create, result, findReusableCheckout, providerCheckout, hasSucceededPayment };
  }

  it('reuses a recent matching payment link without creating another order', async () => {
    const existing = {
      productId: 'monthly',
      amount: 200000,
      checkoutUrl: 'https://auth.robokassa.ru/Merchant/Index.aspx',
      status: 'pending',
    };
    const checkoutResult = await checkout('monthly', false, false, false, existing);
    expect(checkoutResult.result.payment).toBe(existing);
    expect(checkoutResult.create).not.toHaveBeenCalled();
    expect(checkoutResult.providerCheckout).not.toHaveBeenCalled();
    expect(checkoutResult.findReusableCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'monthly',
        amount: 200000,
        purpose: 'new_subscription',
        testMode: false,
        offerVersion: '1',
      }),
    );
  });

  it('charges 2,000 ₽ for the only available first purchase', async () => {
    const monthly = await checkout('monthly', false);
    expect(monthly.created).toMatchObject({
      productId: 'monthly',
      amount: 200000,
      purpose: 'new_subscription',
      testMode: true,
    });
    await expect(checkout('quarterly', false)).rejects.toThrow('Тариф недоступен');
  });

  it('charges a previous payer 2,000 ₽ for 30 days, including an old tariff button', async () => {
    const renewal = await checkout('quarterly', true);
    expect(renewal.created).toMatchObject({
      productId: 'monthly',
      amount: 200000,
      purpose: 'renewal',
    });
    expect(renewal.providerCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 200000 }),
    );
  });

  it('does not grant the live discount from test payments', async () => {
    const exists = vi.spyOn(PaymentModel, 'exists').mockResolvedValueOnce(null);
    const payments = new (
      await import('../src/modules/payments/payment.repository.js')
    ).PaymentRepository();
    expect(await payments.hasSucceededPayment('robokassa', '42', false)).toBe(false);
    expect(exists).toHaveBeenCalledWith(
      expect.objectContaining({
        testMode: false,
        status: 'succeeded',
        isPilotPayment: { $ne: true },
      }),
    );
    exists.mockRestore();
  });

  it('charges exactly 50 ₽ for the live pilot monthly checkout', async () => {
    const pilot = await checkout('monthly', false, false, true);
    expect(pilot.created).toMatchObject({
      productId: 'monthly',
      amount: 5000,
      testMode: false,
      isPilotPayment: true,
      purpose: 'new_subscription',
    });
    expect(pilot.providerCheckout).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000 }));
    expect(pilot.hasSucceededPayment).toHaveBeenCalledWith('robokassa', '42', false);
    expect(pilot.findReusableCheckout).not.toHaveBeenCalled();
  });
});
