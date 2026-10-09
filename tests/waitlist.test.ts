import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/config/env.js';
import type { BotContext } from '../src/bot/context.js';
import { mainKeyboard } from '../src/bot/ui/keyboards/main.keyboard.js';
import { joinWaitlist } from '../src/bot/handlers/waitlist.handler.js';
import { renderProductCheckout } from '../src/bot/handlers/products.handler.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { audienceIds } from '../src/modules/admin/audience.js';
import { getProduct } from '../src/config/products.js';
import { sendContent } from '../src/bot/handlers/admin/admin.handler.js';
import type { Api } from 'grammy';

describe('pre-registration', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('hides purchase buttons and restores them when opening', () => {
    const closed = mainKeyboard(false, {
      PRE_REGISTRATION: true,
    } as AppConfig).inline_keyboard.flat();
    expect(closed).toContainEqual(expect.objectContaining({ callback_data: 'waitlist' }));
    expect(closed.some((b) => 'callback_data' in b && b.callback_data === 'products')).toBe(false);
    expect(
      mainKeyboard(false, { PRE_REGISTRATION: false } as AppConfig).inline_keyboard.flat(),
    ).toContainEqual(expect.objectContaining({ callback_data: 'products' }));
  });
  it('records consent and source only when no previous registration exists', async () => {
    vi.spyOn(UserModel, 'findOne').mockResolvedValue({ lastSourceCode: 'm_breakfast' } as never);
    const update = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);
    const reply = vi.fn();
    const ctx = {
      from: { id: 42 },
      services: { users: { touch: vi.fn() } },
      reply,
    } as unknown as BotContext;
    await joinWaitlist(ctx);
    await joinWaitlist(ctx);
    expect(update).toHaveBeenCalledWith(
      { telegramId: '42', waitlistJoinedAt: { $exists: false } },
      { $set: { waitlistJoinedAt: expect.any(Date) as Date, waitlistSourceCode: 'm_breakfast' } },
    );
    expect(reply).toHaveBeenCalledWith(
      expect.stringContaining('ничего оплачивать'),
      expect.any(Object),
    );
  });
  it('does not create payment from old checkout buttons', async () => {
    const createCheckout = vi.fn();
    const reply = vi.fn();
    const ctx = {
      from: { id: 42 },
      config: { PRE_REGISTRATION: true },
      services: { payments: { createCheckout } },
      reply,
    } as unknown as BotContext;
    await renderProductCheckout(ctx, getProduct('monthly')!);
    expect(createCheckout).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(expect.stringContaining('ЖДУ ОТКРЫТИЯ'), expect.any(Object));
  });
  it('selects only consented users who have not blocked the bot', async () => {
    const distinct = vi.spyOn(UserModel, 'distinct').mockResolvedValue(['42'] as never);
    expect(await audienceIds('waitlist', 3)).toEqual(['42']);
    expect(distinct).toHaveBeenCalledWith('telegramId', {
      waitlistJoinedAt: { $exists: true },
      isBlocked: { $ne: true },
    });
  });
  it('preserves Telegram formatting and sends media captions together', async () => {
    const sendMessage = vi.fn();
    const copyMessage = vi.fn();
    const api = { sendMessage, copyMessage } as unknown as Api;
    const entities = [{ type: 'bold' as const, offset: 0, length: 4 }];
    await sendContent(api, 42, [
      { chatId: 1, messageId: 2, kind: 'text', text: 'Тест', entities },
      { chatId: 1, messageId: 3, kind: 'photo', caption: 'Тест', captionEntities: entities },
    ]);
    expect(sendMessage).toHaveBeenCalledWith(42, 'Тест', { entities });
    expect(copyMessage).toHaveBeenCalledWith(42, 1, 3, {
      caption: 'Тест',
      caption_entities: entities,
    });
  });
});
