import { describe, expect, it, vi } from 'vitest';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import { registerPaymentHandlers } from '../src/bot/handlers/payment.handler.js';

describe('payment check failure', () => {
  it('shows retry and support without asking for another payment', async () => {
    let check!: (ctx: BotContext) => Promise<void>;
    registerPaymentHandlers({
      callbackQuery: vi.fn((_filter: RegExp, handler: typeof check) => {
        check = handler;
      }),
    } as unknown as Bot<BotContext>);
    const reply = vi.fn();
    const id = '12345678-1234-1234-1234-123456789abc';
    const ctx = {
      match: [`check:${id}`, id],
      from: { id: 42 },
      config: { SUPPORT_USERNAME: 'vryblevskaya' },
      services: { payments: { refreshStatus: vi.fn().mockRejectedValue(new Error('temporary')) } },
      reply,
      logger: { warn: vi.fn() },
    } as unknown as BotContext;
    await check(ctx);
    const [text, options] = reply.mock.calls[0] as [
      string,
      { reply_markup: { inline_keyboard: { callback_data?: string; url?: string }[][] } },
    ];
    expect(text).toContain('Не удалось проверить оплату');
    expect(text).toContain('@vryblevskaya');
    expect(options.reply_markup.inline_keyboard.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ callback_data: `check:${id}` }),
        expect.objectContaining({ url: 'https://t.me/vryblevskaya' }),
      ]),
    );
    expect(options.reply_markup.inline_keyboard.every((row) => row.length > 0)).toBe(true);
  });
});
