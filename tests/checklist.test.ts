import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../src/bot/context.js';
import { buildWelcomeScreen, sendWelcome } from '../src/bot/handlers/menu.handler.js';
import { sendChecklist } from '../src/bot/handlers/checklist.handler.js';
import { checklistMessage } from '../src/bot/ui/messages/checklist.message.js';
import { startMessage } from '../src/bot/ui/messages/start.message.js';
import { renderProductCheckout } from '../src/bot/handlers/products.handler.js';
import { getProduct } from '../src/config/products.js';
import type { InlineKeyboard } from 'grammy';

function context() {
  const reply = vi.fn();
  const replyWithPhoto = vi.fn();
  const touch = vi.fn();
  const getActive = vi.fn();
  const answerCallbackQuery = vi.fn();
  const ctx = {
    from: { id: 42 },
    config: { CHECKLIST_MODE: true, START_IMAGE_FILE_ID: 'old_photo' },
    services: { users: { touch }, subscriptions: { getActive } },
    reply,
    replyWithPhoto,
    answerCallbackQuery,
  } as unknown as BotContext;
  return { ctx, reply, replyWithPhoto, touch, getActive, answerCallbackQuery };
}

describe('checklist launch', () => {
  it('shows the opening welcome, club, and documents without the checklist button', async () => {
    const { ctx, reply, replyWithPhoto, getActive } = context();
    const screen = await buildWelcomeScreen(ctx);
    expect(screen?.keyboard?.inline_keyboard.flat()).toEqual([
      { text: '🔍 Вступить в клуб', callback_data: 'products' },
      { text: '✨ Что внутри', callback_data: 'inside' },
      { text: '📄 Информация и условия', callback_data: 'legal' },
    ]);
    await sendWelcome(ctx);
    expect(reply).toHaveBeenCalledWith(startMessage, expect.any(Object));
    expect(startMessage).toContain('Первый месяц — 2 000 ₽');
    expect(startMessage).toContain('Продление — 1 000 ₽/мес.');
    expect(replyWithPhoto).not.toHaveBeenCalled();
    expect(getActive).toHaveBeenCalledWith('42');
  });
  it('shows the account instead of a new purchase to a paid user in launch mode', async () => {
    const { ctx, reply, getActive } = context();
    getActive.mockResolvedValue({ productId: 'monthly', expiresAt: new Date('2026-11-22') });
    await sendWelcome(ctx);
    expect(reply.mock.calls[0]?.[0]).toContain('Доступ активен');
    const options = reply.mock.calls[0]?.[1] as { reply_markup: InlineKeyboard };
    expect(options.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: '👤 Мой аккаунт',
      callback_data: 'subscription',
    });
    expect(options.reply_markup.inline_keyboard.flat()).not.toContainEqual(
      expect.objectContaining({ callback_data: 'products' }),
    );
  });
  it('sends the full checklist with links to club details and documents', async () => {
    const { ctx, reply, touch, answerCallbackQuery } = context();
    Object.assign(ctx, {
      callbackQuery: {
        id: 'click',
        chat_instance: 'chat',
        from: { id: 42, is_bot: false, first_name: 'Test' },
        data: 'checklist',
      },
    });
    await sendChecklist(ctx);
    expect(touch).toHaveBeenCalledWith(ctx.from);
    expect(answerCallbackQuery).toHaveBeenCalledOnce();
    const checklistCall: unknown = reply.mock.calls[0];
    const [message, options] = checklistCall as [
      string,
      { parse_mode: string; reply_markup: InlineKeyboard },
    ];
    expect(message).toBe(checklistMessage);
    expect(options.parse_mode).toBe('HTML');
    expect(options.reply_markup.inline_keyboard).toEqual([
      [{ text: '🔍 Клуб и тарифы', callback_data: 'products' }],
      [{ text: '📄 Информация и условия', callback_data: 'legal' }],
    ]);
    expect(checklistMessage).toContain('1 НОЯБРЯ');
    expect(checklistMessage).toContain('НЕ нужно делать — закупать продукты');
  });
  it('opens a real tariff checkout from the checklist menu', async () => {
    const createCheckout = vi.fn().mockResolvedValue({
      payment: {
        productId: 'monthly',
        purpose: 'new_subscription',
        checkoutUrl: 'https://auth.robokassa.ru/Merchant/Index.aspx',
      },
    });
    const reply = vi.fn();
    const ctx = {
      from: { id: 42 },
      config: { CHECKLIST_MODE: true, PRE_REGISTRATION: false, PUBLIC_PAYMENTS_ENABLED: true },
      services: {
        users: { touch: vi.fn().mockResolvedValue({ _id: 'user-id' }) },
        payments: { createCheckout, hasPaidBefore: vi.fn().mockResolvedValue(false) },
        subscriptions: { getActive: vi.fn().mockResolvedValue(null) },
      },
      reply,
    } as unknown as BotContext;
    await renderProductCheckout(ctx, getProduct('monthly')!);
    expect(createCheckout).toHaveBeenCalledWith({
      userId: 'user-id',
      telegramId: '42',
      productId: 'monthly',
    });
    const call: unknown = reply.mock.calls[0];
    const [message, options] = call as [string, { reply_markup: InlineKeyboard }];
    expect(message.replace(/\s/g, ' ')).toContain('2 000');
    expect(message).toContain('Перейти к оплате');
    expect(options.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: '📄 Информация и условия',
      callback_data: 'legal:monthly',
    });
    expect(options.reply_markup.inline_keyboard.flat()).toContainEqual(
      expect.objectContaining({ url: 'https://auth.robokassa.ru/Merchant/Index.aspx' }),
    );
  });
});
