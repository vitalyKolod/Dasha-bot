import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialModel } from '../src/modules/admin/content.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { deliverMaterial } from '../src/bot/handlers/admin/admin.handler.js';
import type { BotContext } from '../src/bot/context.js';

const item = { chatId: 1, messageId: 7, kind: 'text', text: 'Актуальная версия' };
function fakeContext(active = false) {
  const sendMessage = vi.fn().mockResolvedValue({});
  const copyMessage = vi.fn().mockResolvedValue({});
  const reply = vi.fn().mockResolvedValue({});
  const ctx = {
    from: { id: 42 },
    chat: { id: 42 },
    api: { sendMessage, copyMessage },
    reply,
    services: { subscriptions: { getActive: vi.fn().mockResolvedValue(active ? {} : null) } },
  } as unknown as BotContext;
  return { ctx, sendMessage, reply };
}

describe('material delivery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it('sends current content, records source idempotently, then offers the existing products flow', async () => {
    vi.spyOn(MaterialModel, 'findOne').mockResolvedValue({
      published: true,
      messages: [item],
      inviteText: 'Приходи в клуб',
      inviteButton: 'К тарифам',
    } as never);
    const update = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);
    const { ctx, sendMessage, reply } = fakeContext();
    expect(await deliverMaterial(ctx, 'm_test')).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(42, 'Актуальная версия');
    expect(update).toHaveBeenCalledWith(
      { telegramId: '42' },
      expect.objectContaining({ $addToSet: { receivedMaterialCodes: 'm_test' } }),
      { upsert: true },
    );
    expect(reply.mock.calls[0]?.[0]).toBe('Приходи в клуб');
    expect(reply.mock.calls[0]?.[1]).toHaveProperty('reply_markup');
    vi.spyOn(MaterialModel, 'findOne').mockResolvedValue({
      published: true,
      messages: [{ ...item, text: 'Исправленная версия' }],
      inviteText: 'Приходи в клуб',
      inviteButton: 'К тарифам',
    } as never);
    expect(await deliverMaterial(ctx, 'm_test')).toBe(true);
    expect(sendMessage).toHaveBeenLastCalledWith(42, 'Исправленная версия');
    expect(update).toHaveBeenCalledTimes(4);
  });
  it('rejects an inactive link and skips the purchase invitation for subscribers', async () => {
    vi.spyOn(MaterialModel, 'findOne')
      .mockResolvedValueOnce({ published: false, messages: [item] } as never)
      .mockResolvedValueOnce({ published: true, messages: [item] } as never);
    vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);
    const { ctx, reply, sendMessage } = fakeContext(true);
    expect(await deliverMaterial(ctx, 'm_test')).toBe(false);
    expect(reply).toHaveBeenCalledWith(expect.stringContaining('недоступна'));
    expect(await deliverMaterial(ctx, 'm_test')).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledTimes(1);
  });
});
