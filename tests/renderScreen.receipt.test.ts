import { describe, expect, it, vi } from 'vitest';
import { renderScreen } from '../src/bot/ui/renderScreen.js';
import type { BotContext } from '../src/bot/context.js';

function context(text: string) {
  const answerCallbackQuery = vi.fn().mockResolvedValue(undefined);
  const editMessageText = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);
  const ctx = {
    callbackQuery: { message: { text } },
    answerCallbackQuery,
    editMessageText,
    reply,
    logger: { debug: vi.fn(), warn: vi.fn() },
  } as unknown as BotContext;
  return { ctx, answerCallbackQuery, editMessageText, reply };
}

describe('payment confirmation navigation', () => {
  it('keeps an existing success message and sends the next screen separately', async () => {
    const { ctx, answerCallbackQuery, editMessageText, reply } = context(
      '🎉 Оплата прошла!\n\nДоступ активен',
    );
    await renderScreen(ctx, { text: '👤 Мой аккаунт' });
    expect(answerCallbackQuery).toHaveBeenCalledOnce();
    expect(editMessageText).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith('👤 Мой аккаунт', expect.any(Object));
  });

  it('continues editing ordinary screens', async () => {
    const { ctx, editMessageText, reply } = context('👤 Мой аккаунт');
    await renderScreen(ctx, { text: '🏠 Главное меню' });
    expect(editMessageText).toHaveBeenCalledWith('🏠 Главное меню', expect.any(Object));
    expect(reply).not.toHaveBeenCalled();
  });

  it('starts a new editable panel from a dedicated receipt button', async () => {
    const { ctx, editMessageText, reply } = context('✅ Оплата подтверждена');
    await renderScreen(ctx, { text: '👤 Мой аккаунт' }, true);
    expect(editMessageText).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith('👤 Мой аккаунт', expect.any(Object));
  });
});
