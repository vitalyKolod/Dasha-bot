import { describe, expect, it, vi } from 'vitest';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';
import { registerLegalHandler } from '../src/bot/handlers/legal.handler.js';

describe('live pilot terms', () => {
  it('shows the actual 50 ₽ charge without regular tariff prices', async () => {
    let showLegal!: (ctx: BotContext) => Promise<void>;
    const bot = {
      callbackQuery: vi.fn((filter: RegExp, handler: typeof showLegal) => {
        if (filter.source.startsWith('^legal(?:')) showLegal = handler;
      }),
    } as unknown as Bot<BotContext>;
    registerLegalHandler(bot);
    const reply = vi.fn();
    const ctx = {
      match: ['legal:pilot', 'pilot'],
      from: { id: 42 },
      config: {
        PAYMENT_PROVIDER: 'robokassa',
        ROBOKASSA_TEST_MODE: false,
        ROBOKASSA_LIVE_PILOT_ENABLED: true,
        adminIds: new Set(['42']),
        livePilotIds: new Set(),
      },
      reply,
    } as unknown as BotContext;
    await showLegal(ctx);
    const text = reply.mock.calls[0]?.[0] as string;
    expect(text).toContain('50 ₽');
    expect(text).not.toContain('2 000 ₽');
    expect(text).not.toContain('3 000 ₽');
  });

  it('shows the actual renewal price in monthly terms', async () => {
    let showLegal!: (ctx: BotContext) => Promise<void>;
    const bot = {
      callbackQuery: vi.fn((filter: RegExp, handler: typeof showLegal) => {
        if (filter.source.startsWith('^legal(?:')) showLegal = handler;
      }),
    } as unknown as Bot<BotContext>;
    registerLegalHandler(bot);
    const reply = vi.fn();
    await showLegal({
      match: ['legal:monthly', 'monthly'],
      from: { id: 42 },
      config: {},
      services: { payments: { hasPaidBefore: vi.fn().mockResolvedValue(true) } },
      reply,
    } as unknown as BotContext);
    const text = reply.mock.calls[0]?.[0] as string;
    expect(text).toContain('Продление на 1 месяц');
    expect(text.replace(/\s/g, ' ')).toContain('Стоимость: <b>2 000 ₽</b>');
  });
});
