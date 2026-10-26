import { describe, expect, it, vi } from 'vitest';
import type { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import { registerProductHandlers } from '../src/bot/handlers/products.handler.js';
import { formatMoney } from '../src/bot/ui/helpers/formatMoney.js';

function setup(paidBefore = false, salesOpen = true, active = false) {
  const handlers = new Map<string, (ctx: BotContext) => Promise<void>>();
  const command = vi.fn();
  const bot = {
    command,
    callbackQuery: vi.fn((filter: string | RegExp, handler: (ctx: BotContext) => Promise<void>) => {
      handlers.set(String(filter), handler);
    }),
  } as unknown as Bot<BotContext>;
  registerProductHandlers(bot);
  const reply = vi.fn().mockResolvedValue({});
  const createCheckout = vi.fn().mockImplementation(({ productId }: { productId: string }) =>
    Promise.resolve({
      payment: {
        checkoutUrl: 'https://auth.robokassa.ru/Merchant/Index.aspx',
        productId: paidBefore ? 'monthly' : productId,
        purpose: paidBefore ? 'renewal' : 'new_subscription',
      },
    }),
  );
  const ctx = {
    from: { id: 42 },
    config: {
      PAYMENT_PROVIDER: 'robokassa',
      ROBOKASSA_TEST_MODE: false,
      ROBOKASSA_LIVE_PILOT_ENABLED: false,
      CHECKLIST_MODE: true,
      PRE_REGISTRATION: false,
      PUBLIC_PAYMENTS_ENABLED: salesOpen,
    },
    services: {
      users: { touch: vi.fn().mockResolvedValue({ _id: 'user-id' }) },
      subscriptions: {
        getActive: vi.fn().mockResolvedValue(active ? { expiresAt: new Date() } : null),
      },
      payments: { createCheckout, hasPaidBefore: vi.fn().mockResolvedValue(paidBefore) },
    },
    reply,
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
    logger: { debug: vi.fn() },
  } as unknown as BotContext;
  return { handlers, command, ctx, reply, createCheckout };
}

describe('public production tariffs', () => {
  it('removes the test payment command and its callback', () => {
    const { command, handlers } = setup();
    expect(command).not.toHaveBeenCalledWith('testpayment', expect.any(Function));
    expect([...handlers.keys()].some((key) => key.includes('testpayment'))).toBe(false);
  });

  it('shows both first-purchase tariffs in checklist mode', async () => {
    const { handlers, ctx, reply } = setup();
    await handlers.get('products')!(ctx);
    const options = reply.mock.calls[0]?.[1] as { reply_markup: InlineKeyboard };
    const buttons = options.reply_markup.inline_keyboard.flat();
    expect(
      buttons.some(
        (button) =>
          'callback_data' in button &&
          button.callback_data === 'product:monthly' &&
          button.text.includes(formatMoney(200000)),
      ),
    ).toBe(true);
    expect(
      buttons.some(
        (button) =>
          'callback_data' in button &&
          button.callback_data === 'product:quarterly' &&
          button.text.includes(formatMoney(300000)),
      ),
    ).toBe(true);
  });

  it.each(['monthly', 'quarterly'])(
    'creates a live %s checkout from the regular menu',
    async (productId) => {
      const { handlers, ctx, reply, createCheckout } = setup();
      Object.assign(ctx, { match: [`product:${productId}`, productId] });
      await handlers.get('/^product:([a-z0-9_-]+)$/')!(ctx);
      expect(createCheckout).toHaveBeenCalledWith({
        userId: 'user-id',
        telegramId: '42',
        productId,
      });
      const [message, options] = reply.mock.calls[0] as [string, { reply_markup: InlineKeyboard }];
      expect(message).toContain(formatMoney(productId === 'monthly' ? 200000 : 300000));
      expect(options.reply_markup.inline_keyboard.flat()).toContainEqual(
        expect.objectContaining({ url: 'https://auth.robokassa.ru/Merchant/Index.aspx' }),
      );
    },
  );

  it('offers an existing payer only the 1,000 ₽ monthly renewal', async () => {
    const { handlers, ctx, reply } = setup(true);
    await handlers.get('products')!(ctx);
    const options = reply.mock.calls[0]?.[1] as { reply_markup: InlineKeyboard };
    expect(
      options.reply_markup.inline_keyboard
        .flat()
        .some(
          (button) =>
            'callback_data' in button &&
            button.callback_data === 'product:monthly' &&
            button.text.includes('1 000'),
        ),
    ).toBe(true);
    expect(options.reply_markup.inline_keyboard.flat()).not.toContainEqual(
      expect.objectContaining({ callback_data: 'product:quarterly' }),
    );
  });

  it('lets an active payer open the renewal checkout', async () => {
    const { handlers, ctx, createCheckout } = setup(true, true, true);
    await handlers.get('products')!(ctx);
    Object.assign(ctx, { match: ['product:monthly', 'monthly'] });
    await handlers.get('/^product:([a-z0-9_-]+)$/')!(ctx);
    expect(createCheckout).toHaveBeenCalledWith({
      userId: 'user-id',
      telegramId: '42',
      productId: 'monthly',
    });
  });

  it.each([false, true])(
    'does not create a checkout while sales are closed (paid before: %s)',
    async (paidBefore) => {
      const { handlers, ctx, reply, createCheckout } = setup(paidBefore, false);
      await handlers.get('products')!(ctx);
      expect(reply.mock.calls[0]?.[0]).toContain('Продажи откроются завтра');
      Object.assign(ctx, { match: ['product:quarterly', 'quarterly'] });
      await handlers.get('/^product:([a-z0-9_-]+)$/')!(ctx);
      expect(createCheckout).not.toHaveBeenCalled();
      const [message, options] = reply.mock.calls[1] as [string, { reply_markup: InlineKeyboard }];
      expect(message).toContain('Продажи откроются завтра');
      expect(message).toContain(formatMoney(paidBefore ? 100000 : 300000));
      expect(
        options.reply_markup.inline_keyboard
          .flat()
          .some((button) => 'url' in button && button.text === '💳 Перейти к оплате'),
      ).toBe(false);
    },
  );
});
