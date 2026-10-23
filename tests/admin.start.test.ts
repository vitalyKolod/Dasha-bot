import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerStartHandler } from '../src/bot/handlers/start.handler.js';
import { AdminDialogModel, MaterialModel } from '../src/modules/admin/content.model.js';
import type { Bot } from 'grammy';
import type { BotContext } from '../src/bot/context.js';

let start: (ctx: BotContext) => Promise<void>;
const bot = {
  command: vi.fn((_name: string, handler: typeof start) => {
    start = handler;
  }),
} as unknown as Bot<BotContext>;
function context(payload: string, admin: boolean) {
  const reply = vi.fn().mockResolvedValue({ message_id: 7, chat: { id: 42 } });
  const touch = vi.fn().mockResolvedValue({});
  const findByToken = vi.fn().mockResolvedValue(null);
  const findReturnPayment = vi.fn().mockResolvedValue(null);
  const editMessageText = vi.fn().mockResolvedValue({});
  const getActive = vi.fn().mockResolvedValue(null);
  const ctx = {
    from: { id: 42 },
    chat: { id: 42 },
    match: payload,
    reply,
    config: { adminIds: new Set(admin ? ['42'] : []), NODE_ENV: 'development' },
    services: {
      users: { touch },
      payments: { findByToken, findReturnPayment },
      subscriptions: { getActive },
    },
    api: { editMessageText },
    logger: { info: vi.fn() },
  } as unknown as BotContext;
  return { ctx, reply, findByToken, findReturnPayment, editMessageText, getActive };
}
beforeEach(() => {
  vi.restoreAllMocks();
  registerStartHandler(bot);
});

describe('/start routing', () => {
  it('shows the confirmed invoice status instead of the checklist menu', async () => {
    const { ctx, reply, findReturnPayment, editMessageText } = context('payment_123', false);
    ctx.config.CHECKLIST_MODE = true;
    findReturnPayment.mockResolvedValue({ status: 'succeeded', processedAt: new Date() });
    await start(ctx);
    expect(findReturnPayment).toHaveBeenCalledWith('42', '123');
    expect(reply).toHaveBeenCalledWith('⏳ Проверяем оплату…');
    expect(editMessageText).toHaveBeenCalledWith(
      42,
      7,
      expect.stringContaining('Оплата подтверждена'),
      expect.objectContaining({ reply_markup: expect.any(Object) as object }),
    );
  });
  it('tells the buyer to wait for the webhook when confirmation is pending', async () => {
    const { ctx, findReturnPayment, editMessageText } = context('payment_success', false);
    ctx.config.CHECKLIST_MODE = true;
    findReturnPayment.mockResolvedValue({ status: 'pending' });
    await start(ctx);
    expect(findReturnPayment).toHaveBeenCalledWith('42', undefined);
    expect(editMessageText).toHaveBeenCalledWith(
      42,
      7,
      expect.stringContaining('Повторно оплачивать пока не нужно'),
      {},
    );
  });
  it('replaces old deep links with checklist welcome in launch mode', async () => {
    const { ctx, reply, findByToken, getActive } = context(`pay_${'A'.repeat(40)}`, false);
    ctx.config.CHECKLIST_MODE = true;
    await start(ctx);
    expect(findByToken).not.toHaveBeenCalled();
    expect(getActive).toHaveBeenCalledWith('42');
    expect(reply.mock.calls[0]?.[0]).toContain('подготовки твоей морозилки');
  });
  it('keeps pay_ links on the existing payment path', async () => {
    const { ctx, reply, findByToken } = context(`pay_${'A'.repeat(40)}`, true);
    const material = vi.spyOn(MaterialModel, 'findOne');
    await start(ctx);
    expect(findByToken).toHaveBeenCalledWith('A'.repeat(40));
    expect(material).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith('Ссылка недействительна или устарела.');
  });
  it('opens the Telegram admin menu for an ordinary admin start', async () => {
    vi.spyOn(AdminDialogModel, 'deleteOne').mockResolvedValue({} as never);
    const { ctx, reply } = context('', true);
    await start(ctx);
    expect(reply.mock.calls[0]?.[0]).toContain('админки');
    expect(reply.mock.calls[0]?.[1]).toHaveProperty('reply_markup');
  });
  it('keeps the user welcome flow for a normal user', async () => {
    const { ctx, reply, getActive } = context('', false);
    await start(ctx);
    expect(getActive).toHaveBeenCalledWith('42');
    expect(reply).toHaveBeenCalled();
  });
});
