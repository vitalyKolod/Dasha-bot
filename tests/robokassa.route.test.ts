import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerRobokassaRoute } from '../src/http/routes/robokassa.route.js';
import { RobokassaPaymentProvider } from '../src/modules/payments/providers/robokassa.provider.js';
import type { PaymentService } from '../src/modules/payments/payment.service.js';
import type { PaymentDeliveryService } from '../src/modules/payments/paymentDelivery.service.js';
import type { AppConfig } from '../src/config/env.js';
import type { Logger } from 'pino';

const provider = new RobokassaPaymentProvider({
  merchantLogin: 'shop',
  password1: 'one',
  password2: 'two',
  testMode: true,
});
const signedBody = (amount = '990.00') => ({
  OutSum: amount,
  InvId: '42',
  Shp_mode: 'test',
  SignatureValue: createHash('sha256').update(`${amount}:42:two:Shp_mode=test`).digest('hex'),
});

function setup() {
  const server = Fastify();
  const handleVerifiedEvent = vi.fn().mockResolvedValue({ subscription: {} });
  const runOnce = vi.fn().mockResolvedValue(undefined);
  const logger = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;
  registerRobokassaRoute(
    server,
    provider,
    { handleVerifiedEvent } as unknown as PaymentService,
    { runOnce } as unknown as PaymentDeliveryService,
    logger,
    { BOT_USERNAME: 'dasha_zagotovki_bot' } as AppConfig,
  );
  return { server, handleVerifiedEvent, runOnce };
}

describe('Robokassa result and return pages', () => {
  it('still accepts an outstanding test callback after live pilot is enabled', async () => {
    const server = Fastify();
    const handleVerifiedEvent = vi.fn().mockResolvedValue({ subscription: {} });
    const runOnce = vi.fn().mockResolvedValue(undefined);
    const liveProvider = new RobokassaPaymentProvider({
      merchantLogin: 'shop',
      password1: 'live-one',
      password2: 'live-two',
      testMode: false,
    });
    registerRobokassaRoute(
      server,
      liveProvider,
      { handleVerifiedEvent } as unknown as PaymentService,
      { runOnce } as unknown as PaymentDeliveryService,
      { info: vi.fn(), warn: vi.fn() } as unknown as Logger,
      {
        BOT_USERNAME: 'dasha_zagotovki_bot',
        ROBOKASSA_TEST_MODE: false,
        ROBOKASSA_MERCHANT_LOGIN: 'shop',
        ROBOKASSA_TEST_PASSWORD_1: 'one',
        ROBOKASSA_TEST_PASSWORD_2: 'two',
      } as AppConfig,
    );
    const reply = await server.inject({
      method: 'POST',
      url: '/payments/robokassa/result',
      payload: signedBody(),
    });
    expect(reply.body).toBe('OK42');
    expect(handleVerifiedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { testMode: true } }),
    );
    await server.close();
  });
  it('acknowledges a verified payment and schedules delivery', async () => {
    const { server, handleVerifiedEvent, runOnce } = setup();
    const reply = await server.inject({
      method: 'POST',
      url: '/payments/robokassa/result',
      payload: signedBody(),
    });
    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBe('OK42');
    expect(handleVerifiedEvent).toHaveBeenCalledOnce();
    expect(runOnce).toHaveBeenCalledOnce();
    await server.close();
  });
  it('acknowledges a duplicate without scheduling a second delivery', async () => {
    const { server, handleVerifiedEvent, runOnce } = setup();
    handleVerifiedEvent.mockResolvedValue(null);
    const reply = await server.inject({
      method: 'POST',
      url: '/payments/robokassa/result',
      payload: signedBody(),
    });
    expect(reply.body).toBe('OK42');
    expect(runOnce).not.toHaveBeenCalled();
    await server.close();
  });
  it('rejects invalid signatures before touching the order', async () => {
    const { server, handleVerifiedEvent } = setup();
    const reply = await server.inject({
      method: 'POST',
      url: '/payments/robokassa/result',
      payload: { ...signedBody(), SignatureValue: '0'.repeat(64) },
    });
    expect(reply.statusCode).toBe(401);
    expect(handleVerifiedEvent).not.toHaveBeenCalled();
    await server.close();
  });
  it('shows static return pages without confirming payment', async () => {
    const { server, handleVerifiedEvent } = setup();
    const success = await server.inject('/payments/robokassa/success');
    const fail = await server.inject('/payments/robokassa/fail');
    expect(success.body).toContain('Оплата завершена. Вернитесь в Telegram');
    expect(fail.body).toContain('Оплата не завершена');
    expect(success.body).toContain('https://t.me/dasha_zagotovki_bot');
    const withInvoice = await server.inject('/payments/robokassa/success?InvId=42');
    expect(withInvoice.body).toContain('?start=payment_42');
    const invalidInvoice = await server.inject('/payments/robokassa/success?InvId=wrong');
    expect(invalidInvoice.body).toContain('?start=payment_success');
    expect(handleVerifiedEvent).not.toHaveBeenCalled();
    await server.close();
  });
});
