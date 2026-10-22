import { describe, expect, it, vi } from 'vitest';
import { PaymentService } from '../src/modules/payments/payment.service.js';
import type { PaymentRepository } from '../src/modules/payments/payment.repository.js';
import type { PaymentProvider } from '../src/modules/payments/PaymentProvider.js';
import type { SubscriptionService } from '../src/modules/subscriptions/subscription.service.js';
import type { AppConfig } from '../src/config/env.js';
import type { Logger } from 'pino';

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
