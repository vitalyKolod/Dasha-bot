import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../src/bot/context.js';
import { buildWelcomeScreen, sendWelcome } from '../src/bot/handlers/menu.handler.js';
import { sendChecklist } from '../src/bot/handlers/checklist.handler.js';
import { checklistMessage, checklistWelcome } from '../src/bot/ui/messages/checklist.message.js';

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
  it('shows one checklist button and skips subscription and media flows', async () => {
    const { ctx, reply, replyWithPhoto, getActive } = context();
    const screen = await buildWelcomeScreen(ctx);
    expect(screen?.keyboard?.inline_keyboard.flat()).toEqual([
      { text: '❄️ Получить чек-лист', callback_data: 'checklist' },
    ]);
    await sendWelcome(ctx);
    expect(reply).toHaveBeenCalledWith(checklistWelcome, expect.any(Object));
    expect(replyWithPhoto).not.toHaveBeenCalled();
    expect(getActive).not.toHaveBeenCalled();
  });
  it('sends the full checklist as a new text message without buttons', async () => {
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
    expect(reply).toHaveBeenCalledExactlyOnceWith(checklistMessage, { parse_mode: 'HTML' });
    expect(checklistMessage).toContain('1 НОЯБРЯ');
    expect(checklistMessage).toContain('НЕ нужно делать — закупать продукты');
  });
});
