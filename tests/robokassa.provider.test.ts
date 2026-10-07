import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RobokassaPaymentProvider } from '../src/modules/payments/providers/robokassa.provider.js';
describe('Robokassa webhook', () => {
  it('verifies Password #2 signature and converts rubles to kopecks', () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'one',
      password2: 'two',
      testMode: true,
    });
    const signature = createHash('sha256').update('990.00:42:two').digest('hex');
    const event = provider.verifyWebhook({
      OutSum: '990.00',
      InvId: '42',
      SignatureValue: signature,
    });
    expect(event.amount).toBe(99000);
    expect(event.status).toBe('succeeded');
  });
  it('rejects a forged signature', () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'one',
      password2: 'two',
      testMode: true,
    });
    expect(() =>
      provider.verifyWebhook({ OutSum: '990.00', InvId: '42', SignatureValue: '0'.repeat(64) }),
    ).toThrow('Invalid Robokassa signature');
  });
});

describe('Robokassa checkout', () => {
  it('uses SHA256, the stored invoice and test mode', async () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'one',
      password2: 'two',
      testMode: true,
    });
    const checkout = await provider.createCheckout({
      paymentId: 'p',
      invoiceId: '42',
      amount: 99000,
      currency: 'RUB',
      description: 'Access',
      returnUrl: 'https://example.org/return',
    });
    const url = new URL(checkout.checkoutUrl);
    expect(url.searchParams.get('OutSum')).toBe('990.00');
    expect(url.searchParams.get('InvId')).toBe('42');
    expect(checkout.providerPaymentId).toBe('42');
    expect(url.searchParams.get('IsTest')).toBe('1');
    expect(url.searchParams.get('SignatureValue')).toBe(
      createHash('sha256').update('shop:990.00:42:one').digest('hex'),
    );
  });
  it('accepts Robokassa six-decimal amount without floating point conversion', () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'one',
      password2: 'two',
      testMode: true,
    });
    const signature = createHash('sha256').update('990.000000:42:two').digest('hex');
    expect(
      provider.verifyWebhook({ OutSum: '990.000000', InvId: '42', SignatureValue: signature })
        .amount,
    ).toBe(99000);
  });
});
