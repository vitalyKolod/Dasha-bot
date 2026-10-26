import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../src/bot/context.js';
import { showAccount, showClubLink } from '../src/bot/handlers/subscription.handler.js';
import type { InlineKeyboard } from 'grammy';

function context(member = false) {
  const reply = vi.fn();
  const getClubAccess = vi.fn().mockResolvedValue({
    url: member ? 'https://t.me/c/4334407084/1' : 'https://t.me/+private',
    member,
  });
  const ctx = {
    from: { id: 42 },
    config: { CHECKLIST_MODE: true, PRE_REGISTRATION: true },
    services: {
      subscriptions: {
        getActive: vi.fn().mockResolvedValue({
          telegramId: '42',
          productId: 'quarterly',
          expiresAt: new Date('2026-12-22'),
        }),
      },
      access: { getClubAccess },
    },
    reply,
    logger: { warn: vi.fn() },
  } as unknown as BotContext;
  return { ctx, reply, getClubAccess };
}

describe('paid club account', () => {
  it('shows tariff, expiry and a protected join button', async () => {
    const { ctx, reply } = context();
    await showAccount(ctx);
    const [text, options] = reply.mock.calls[0] as [string, { reply_markup: InlineKeyboard }];
    expect(text).toContain('3 месяца');
    expect(text).toContain('Оплачено до');
    const buttons = options.reply_markup.inline_keyboard.flat();
    expect(buttons).toContainEqual(
      expect.objectContaining({
        text: '👉 Получить ссылку для входа',
        callback_data: 'subscription:open',
      }),
    );
    expect(buttons).toContainEqual({ text: '🔁 Продлить доступ', callback_data: 'products' });
  });

  it('opens the club directly for an existing member and offers renewal', async () => {
    const { ctx, reply } = context(true);
    await showAccount(ctx);
    const [text, options] = reply.mock.calls[0] as [string, { reply_markup: InlineKeyboard }];
    expect(text).toContain('Мой аккаунт');
    expect(options.reply_markup.inline_keyboard.flat()).toContainEqual(
      expect.objectContaining({ text: '🍳 Открыть клуб', url: 'https://t.me/c/4334407084/1' }),
    );
    expect(options.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: '🔁 Продлить доступ',
      callback_data: 'products',
    });
  });

  it('can request a fresh invitation when a link stops working', async () => {
    const { ctx, getClubAccess, reply } = context();
    await showClubLink(ctx);
    expect(getClubAccess).toHaveBeenCalledWith(expect.any(Object), true);
    const [, options] = reply.mock.calls[0] as [string, { reply_markup: InlineKeyboard }];
    expect(options.reply_markup.inline_keyboard.flat()).toContainEqual(
      expect.objectContaining({ url: 'https://t.me/+private' }),
    );
  });
});
