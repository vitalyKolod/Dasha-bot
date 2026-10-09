import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAdminHandlers } from '../src/bot/handlers/admin/admin.handler.js';
import { BroadcastDraftModel } from '../src/modules/admin/content.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import type { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../src/bot/context.js';

type Handler = (ctx: BotContext) => Promise<void>;
const handlers = new Map<string, Handler>();
const bot = {
  command: vi.fn(),
  on: vi.fn(),
  callbackQuery: vi.fn((query: string | RegExp, handler: Handler) => {
    if (typeof query === 'string') handlers.set(query, handler);
    else handlers.set(query.source, handler);
  }),
} as unknown as Bot<BotContext>;

function context(admin = true, match: string[] = []) {
  const reply = vi.fn().mockResolvedValue({});
  const ctx = {
    from: { id: 42 },
    chat: { id: 42 },
    match,
    reply,
    config: { adminIds: new Set(admin ? ['42'] : []), ADMIN_EXPIRING_DAYS: 3 },
  } as unknown as BotContext;
  return { ctx, reply };
}

beforeEach(() => {
  vi.restoreAllMocks();
  handlers.clear();
  registerAdminHandlers(bot);
});

describe('admin UI', () => {
  it('rejects a non-admin before loading a draft', async () => {
    const draft = vi.spyOn(BroadcastDraftModel, 'findOneAndUpdate');
    const { ctx, reply } = context(false);
    await handlers.get('admin:bc:confirm')!(ctx);
    expect(draft).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });
  it('shows audience and recipient count before the explicit send button', async () => {
    vi.spyOn(BroadcastDraftModel, 'findOneAndUpdate').mockResolvedValue({
      id: 'a'.repeat(24),
      messages: [{ kind: 'text' }],
      audience: 'unpaid',
    });
    vi.spyOn(UserModel, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ telegramId: '1' }, { telegramId: '2' }]),
    } as never);
    const { PaymentModel } = await import('../src/modules/payments/payment.model.js');
    vi.spyOn(PaymentModel, 'distinct').mockResolvedValue(['2'] as never);
    const { ctx, reply } = context();
    await handlers.get('admin:bc:confirm')!(ctx);
    const [text, options] = reply.mock.calls[0] as [string, { reply_markup: InlineKeyboard }];
    expect(text).toContain('Не оплатили');
    expect(text).toContain('Получателей: <b>1</b>');
    expect(
      options.reply_markup.inline_keyboard
        .flat()
        .some((b) => 'callback_data' in b && b.callback_data === `admin:bc:send:${'a'.repeat(24)}`),
    ).toBe(true);
  });
  it('paginates the real user list', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => ({ telegramId: String(i + 1) }));
    vi.spyOn(UserModel, 'find').mockImplementation((() => {
      return {
        lean: vi.fn().mockResolvedValue(ids),
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(ids.slice(8)) }),
        }),
      };
    }) as never);
    const { ctx, reply } = context(true, ['', 'started', '1']);
    await handlers.get(
      '^admin:users(?::(started|waitlist|unpaid|active|expiring|expired):([0-9]+))?$',
    )!(ctx);
    expect(reply.mock.calls[0]?.[0]).toContain('страница 2/2');
  });
});
