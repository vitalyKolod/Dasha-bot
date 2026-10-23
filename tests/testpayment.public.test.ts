import { describe, expect, it, vi } from 'vitest';
import type { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import { registerProductHandlers } from '../src/bot/handlers/products.handler.js';

function setup(testMode: boolean) {
  let command!: (ctx: BotContext) => Promise<void>;
  let chooseProduct!: (ctx: BotContext) => Promise<void>;
  const bot = {
    command: vi.fn((name: string, handler: typeof command) => {
      if (name === 'testpayment') command = handler;
    }),
    callbackQuery: vi.fn((filter: string | RegExp, handler: typeof chooseProduct) => {
      if (String(filter).includes('testpayment:')) chooseProduct = handler;
    }),
  } as unknown as Bot<BotContext>;
  registerProductHandlers(bot);
  const reply = vi.fn().mockResolvedValue({});
  const createCheckout = vi.fn().mockResolvedValue({
    payment: { checkoutUrl: 'https://auth.robokassa.ru/Merchant/Index.aspx' },
  });
  const ctx = {
    from: { id: 42 },
    config: {
      PAYMENT_PROVIDER: 'robokassa',
      ROBOKASSA_TEST_MODE: testMode,
      CHECKLIST_MODE: true,
      PRE_REGISTRATION: true,
      adminIds: new Set(),
    },
    services: {
      users: { touch: vi.fn().mockResolvedValue({ _id: 'user-id' }) },
      subscriptions: { getActive: vi.fn().mockResolvedValue(null) },
      payments: { createCheckout },
    },
    reply,
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
    logger: { debug: vi.fn() },
  } as unknown as BotContext;
  return { command, chooseProduct, ctx, reply, createCheckout };
}

describe('/testpayment for a non-admin user', () => {
  it('opens a test checkout while checklist and preregistration are active', async () => {
    const { command, chooseProduct, ctx, reply, createCheckout } = setup(true);
    await command(ctx);
    const commandReply = reply.mock.calls[0] as unknown as [
      string,
      { reply_markup: InlineKeyboard },
    ];
    const keyboard = commandReply[1].reply_markup;
    expect(keyboard.inline_keyboard[0]?.[0]).toMatchObject({
      callback_data: 'testpayment:monthly',
    });
    Object.assign(ctx, { callbackQuery: {}, match: ['testpayment:monthly', 'monthly'] });
    await chooseProduct(ctx);
    expect(createCheckout).toHaveBeenCalledWith({
      userId: 'user-id',
      telegramId: '42',
      productId: 'monthly',
      renewal: false,
    });
    const checkoutReply = reply.mock.calls[1] as unknown as [
      string,
      { reply_markup: InlineKeyboard },
    ];
    expect(checkoutReply[1].reply_markup.inline_keyboard[0]?.[0]).toMatchObject({
      url: 'https://auth.robokassa.ru/Merchant/Index.aspx',
    });
  });

  it('does not open the test flow when test mode is off', async () => {
    const { command, chooseProduct, ctx, reply, createCheckout } = setup(false);
    await command(ctx);
    Object.assign(ctx, { callbackQuery: {}, match: ['testpayment:monthly', 'monthly'] });
    await chooseProduct(ctx);
    expect(reply).not.toHaveBeenCalled();
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
