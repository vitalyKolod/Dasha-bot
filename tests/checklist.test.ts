import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../src/bot/context.js';
import { buildWelcomeScreen, sendWelcome } from '../src/bot/handlers/menu.handler.js';
import { sendChecklist } from '../src/bot/handlers/checklist.handler.js';
import { checklistMessage, checklistWelcome } from '../src/bot/ui/messages/checklist.message.js';
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
  it('shows checklist, club, and documents without subscription or media flows', async () => {
    const { ctx, reply, replyWithPhoto, getActive } = context();
    const screen = await buildWelcomeScreen(ctx);
    expect(screen?.keyboard?.inline_keyboard.flat()).toEqual([
      { text: '❄️ Получить чек-лист', callback_data: 'checklist' },
      { text: '🔍 Вступить в клуб', callback_data: 'products' },
      { text: '✨ Что внутри', callback_data: 'inside' },
      { text: '📄 Информация и условия', callback_data: 'legal' },
    ]);
    await sendWelcome(ctx);
    expect(reply).toHaveBeenCalledWith(checklistWelcome, expect.any(Object));
    expect(replyWithPhoto).not.toHaveBeenCalled();
    expect(getActive).not.toHaveBeenCalled();
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
  it('shows tariff and legal documents without creating a payment', async () => {
    const createCheckout = vi.fn();
    const reply = vi.fn();
    const ctx = {
      from: { id: 42 },
      config: { CHECKLIST_MODE: true, PRE_REGISTRATION: true },
      services: { payments: { createCheckout } },
      reply,
    } as unknown as BotContext;
    await renderProductCheckout(ctx, getProduct('monthly')!);
    expect(createCheckout).not.toHaveBeenCalled();
    const call: unknown = reply.mock.calls[0];
    const [message, options] = call as [string, { reply_markup: InlineKeyboard }];
    expect(message).toContain('990');
    expect(message).toContain('Оплата откроется после запуска клуба');
    expect(options.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: '📄 Информация и условия',
      callback_data: 'legal:monthly',
    });
    expect(options.reply_markup.inline_keyboard.flat().some((button) => 'url' in button)).toBe(
      false,
    );
  });
});
