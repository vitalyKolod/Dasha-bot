import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RobokassaPaymentProvider } from '../src/modules/payments/providers/robokassa.provider.js';
describe('Robokassa webhook', () => {
  it('accepts the live Password #2 signature for a 50 ₽ payment', () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'live-one',
      password2: 'live-two',
      testMode: false,
    });
    const event = provider.verifyWebhook({
      OutSum: '50.00',
      InvId: '42',
      Shp_mode: 'live',
      SignatureValue: createHash('sha256').update('50.00:42:live-two:Shp_mode=live').digest('hex'),
    });
    expect(event.amount).toBe(5000);
    expect(() =>
      provider.verifyWebhook({
        OutSum: '50.00',
        InvId: '42',
        Shp_mode: 'live',
        SignatureValue: createHash('sha256')
          .update('50.00:42:test-two:Shp_mode=live')
          .digest('hex'),
      }),
    ).toThrow('Invalid Robokassa signature');
  });
  it('verifies Password #2 signature and converts rubles to kopecks', () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'one',
      password2: 'two',
      testMode: true,
    });
    const signature = createHash('sha256').update('990.00:42:two:Shp_mode=test').digest('hex');
    const event = provider.verifyWebhook({
      OutSum: '990.00',
      InvId: '42',
      SignatureValue: signature,
      Shp_mode: 'test',
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
      provider.verifyWebhook({
        OutSum: '990.00',
        InvId: '42',
        SignatureValue: '0'.repeat(64),
        Shp_mode: 'test',
      }),
    ).toThrow('Invalid Robokassa signature');
  });
  it('rejects an amount change even with the original signature', () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'one',
      password2: 'two',
      testMode: true,
    });
    const signature = createHash('sha256').update('990.00:42:two:Shp_mode=test').digest('hex');
    expect(() =>
      provider.verifyWebhook({
        OutSum: '991.00',
        InvId: '42',
        SignatureValue: signature,
        Shp_mode: 'test',
      }),
    ).toThrow('Invalid Robokassa signature');
  });
  it('rejects a webhook from the wrong mode', () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'one',
      password2: 'two',
      testMode: true,
    });
    const signature = createHash('sha256').update('990.00:42:two:Shp_mode=live').digest('hex');
    expect(() =>
      provider.verifyWebhook({
        OutSum: '990.00',
        InvId: '42',
        SignatureValue: signature,
        Shp_mode: 'live',
      }),
    ).toThrow('Invalid Robokassa mode');
  });
});

describe('Robokassa checkout', () => {
  it('includes a 1,000 ₽ fiscal receipt item for a live renewal', async () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'live-one',
      password2: 'live-two',
      testMode: false,
    });
    const checkout = await provider.createCheckout({
      paymentId: 'renewal',
      invoiceId: '43',
      amount: 100000,
      currency: 'RUB',
      description: 'Доступ в кулинарный клуб на 30 дней',
      returnUrl: 'https://example.org/return',
    });
    const url = new URL(checkout.checkoutUrl);
    expect(url.searchParams.get('OutSum')).toBe('1000.00');
    const receipt: unknown = JSON.parse(decodeURIComponent(url.searchParams.get('Receipt')!));
    expect(receipt).toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ sum: 1000 })] }),
    );
  });
  it('uses live Password #1 and omits IsTest for a real payment', async () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'live-one',
      password2: 'live-two',
      testMode: false,
    });
    const checkout = await provider.createCheckout({
      paymentId: 'p',
      invoiceId: '42',
      amount: 200000,
      currency: 'RUB',
      description: 'Club access',
      returnUrl: 'https://example.org/return',
    });
    const url = new URL(checkout.checkoutUrl);
    expect(url.searchParams.get('OutSum')).toBe('2000.00');
    expect(url.searchParams.has('IsTest')).toBe(false);
    expect(url.searchParams.get('Shp_mode')).toBe('live');
    const encodedReceipt = url.searchParams.get('Receipt');
    expect(url.search).toContain(`Receipt=${encodeURIComponent(encodedReceipt!)}`);
    expect(JSON.parse(decodeURIComponent(encodedReceipt!))).toEqual({
      items: [
        {
          name: 'Club access',
          quantity: 1,
          sum: 2000,
          payment_method: 'full_payment',
          payment_object: 'service',
          tax: 'none',
        },
      ],
    });
    expect(url.searchParams.get('SignatureValue')).toBe(
      createHash('sha256')
        .update(`shop:2000.00:42:${encodedReceipt}:live-one:Shp_mode=live`)
        .digest('hex'),
    );
  });
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
    expect(url.searchParams.get('Shp_mode')).toBe('test');
    expect(url.searchParams.get('SignatureValue')).toBe(
      createHash('sha256').update('shop:990.00:42:one:Shp_mode=test').digest('hex'),
    );
  });
  it('accepts Robokassa six-decimal amount without floating point conversion', () => {
    const provider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'one',
      password2: 'two',
      testMode: true,
    });
    const signature = createHash('sha256').update('990.000000:42:two:Shp_mode=test').digest('hex');
    expect(
      provider.verifyWebhook({
        OutSum: '990.000000',
        InvId: '42',
        SignatureValue: signature,
        Shp_mode: 'test',
      }).amount,
    ).toBe(99000);
  });
});
