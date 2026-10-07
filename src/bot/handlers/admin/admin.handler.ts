import { InlineKeyboard, type Bot, type Api } from 'grammy';
import type { Logger } from 'pino';
import { randomBytes } from 'node:crypto';
import type { BotContext } from '../../context.js';
import { adminBackKeyboard, adminKeyboard } from '../../ui/keyboards/admin.keyboard.js';
import { AdminService } from '../../../modules/admin/admin.service.js';
import { formatMoney } from '../../ui/helpers/formatMoney.js';
import { escapeHtml } from '../../ui/helpers/escapeHtml.js';
import { renderScreen } from '../../ui/renderScreen.js';
import {
  AdminDialogModel,
  BroadcastDraftModel,
  MaterialModel,
  type ContentMessage,
} from '../../../modules/admin/content.model.js';
import {
  AUDIENCES,
  audienceIds,
  isAudience,
  type Audience,
} from '../../../modules/admin/audience.js';
import { UserModel } from '../../../modules/users/user.model.js';
import { PaymentModel } from '../../../modules/payments/payment.model.js';
import { SubscriptionModel } from '../../../modules/subscriptions/subscription.model.js';
import { sleep } from '../../../shared/utils/sleep.js';

const isAdmin = (ctx: BotContext) =>
  Boolean(ctx.from && ctx.config.adminIds.has(String(ctx.from.id)));
const idPattern = '[a-f0-9]{24}';
const defaultInvite = 'Хочешь готовить проще каждый день? Загляни в закрытый клуб 💛';
const defaultButton = 'Посмотреть клуб';
const h = (value: string | number | undefined | null) => escapeHtml(String(value ?? '—'));
const short = (value: string, length = 35) =>
  value.length > length ? `${value.slice(0, length)}…` : value;
const date = (value?: Date | null) => (value ? new Date(value).toLocaleString('ru-RU') : '—');
const ownDialog = (ctx: BotContext) => AdminDialogModel.findOne({ adminId: String(ctx.from!.id) });
const setDialog = (ctx: BotContext, mode: string, targetId?: string, index?: number) =>
  AdminDialogModel.findOneAndUpdate(
    { adminId: String(ctx.from!.id) },
    { $set: { mode, targetId, index } },
    { upsert: true, new: true },
  );
const clearDialog = (ctx: BotContext) =>
  AdminDialogModel.deleteOne({ adminId: String(ctx.from!.id) });
const menu = (ctx: BotContext) =>
  renderScreen(ctx, {
    text: `🛠 <b>Админка Даши</b>\n\nВыберите раздел:`,
    keyboard: adminKeyboard(ctx.config.NODE_ENV !== 'production'),
  });
const back = (callback: string) =>
  new InlineKeyboard().text('← Назад', callback).row().text('🏠 Главное меню', 'admin:menu');
const cancel = (callback: string) =>
  new InlineKeyboard().text('Отмена', callback).row().text('🏠 Главное меню', 'admin:menu');
const materialLink = (ctx: BotContext, code: string) =>
  `https://t.me/${ctx.config.BOT_USERNAME?.replace(/^@/, '')}?start=${code}`;

export async function sendContent(api: Api, chatId: number, messages: ContentMessage[]) {
  for (const item of messages) {
    if (item.kind === 'text' && item.text !== undefined) await api.sendMessage(chatId, item.text);
    else
      await api.copyMessage(
        chatId,
        item.chatId,
        item.messageId,
        item.caption !== undefined ? { caption: item.caption } : {},
      );
  }
}

export async function deliverMaterial(ctx: BotContext, code: string): Promise<boolean> {
  const material = await MaterialModel.findOne({ code });
  if (!material || !material.published || !material.messages.length) {
    await ctx.reply('Эта ссылка на материал недоступна. Проверьте ссылку или обратитесь к Даше.');
    return false;
  }
  await sendContent(ctx.api, ctx.chat!.id, material.messages);
  if (ctx.from) {
    const telegramId = String(ctx.from.id);
    await UserModel.updateOne(
      { telegramId },
      {
        $set: { lastSourceCode: code },
        $setOnInsert: { firstSourceCode: code },
        $addToSet: { receivedMaterialCodes: code },
      },
      { upsert: true },
    );
    await UserModel.updateOne(
      { telegramId, firstSourceCode: { $exists: false } },
      { $set: { firstSourceCode: code } },
    );
    const active = await ctx.services.subscriptions.getActive(telegramId);
    if (!active)
      await ctx.reply(material.inviteText || defaultInvite, {
        reply_markup: new InlineKeyboard().text(material.inviteButton || defaultButton, 'products'),
      });
  }
  return true;
}

function contentFromMessage(message: BotContext['message']): ContentMessage | null {
  if (!message) return null;
  const kind = message.text
    ? 'text'
    : message.photo
      ? 'photo'
      : message.video
        ? 'video'
        : message.document
          ? 'document'
          : message.video_note
            ? 'video_note'
            : message.audio
              ? 'audio'
              : message.voice
                ? 'voice'
                : message.animation
                  ? 'animation'
                  : message.sticker
                    ? 'sticker'
                    : null;
  if (!kind) return null;
  return {
    chatId: message.chat.id,
    messageId: message.message_id,
    kind,
    ...(message.text ? { text: message.text } : {}),
    ...(message.caption ? { caption: message.caption } : {}),
  };
}

async function materialList(ctx: BotContext, page = 0) {
  await clearDialog(ctx);
  const total = await MaterialModel.countDocuments();
  const pages = Math.max(1, Math.ceil(total / 8));
  page = Math.min(Math.max(page, 0), pages - 1);
  const items = await MaterialModel.find()
    .sort({ createdAt: -1 })
    .skip(page * 8)
    .limit(8);
  const kb = new InlineKeyboard().text('➕ Создать материал', 'admin:mat:new').row();
  items.forEach((m) =>
    kb.text(`${m.published ? '🟢' : '⚪'} ${short(m.title)}`, `admin:mat:open:${m.id}`).row(),
  );
  if (page) kb.text('←', `admin:materials:${page - 1}`);
  if (page + 1 < pages) kb.text('→', `admin:materials:${page + 1}`);
  kb.row().text('🏠 Главное меню', 'admin:menu');
  await renderScreen(ctx, {
    text: `🎁 <b>Материалы и ссылки</b>\nСтраница ${page + 1}/${pages}. Всего: ${total}`,
    keyboard: kb,
  });
}

async function materialCard(ctx: BotContext, id: string) {
  await clearDialog(ctx);
  const m = await MaterialModel.findById(id);
  if (!m) {
    await materialList(ctx);
    return;
  }
  const kb = new InlineKeyboard()
    .text('👀 Предпросмотр', `admin:mat:preview:${id}`)
    .row()
    .text('➕ Добавить', `admin:mat:add:${id}`)
    .text('✏️ Сообщения', `admin:mat:messages:${id}`)
    .row()
    .text('Название', `admin:mat:field:title:${id}`)
    .text('Пометка', `admin:mat:field:note:${id}`)
    .row()
    .text('Текст приглашения', `admin:mat:field:inviteText:${id}`)
    .row()
    .text('Кнопка приглашения', `admin:mat:field:inviteButton:${id}`)
    .row();
  if (m.published) kb.text('⏸ Отключить', `admin:mat:toggle:${id}`).row();
  else kb.text('🚀 Опубликовать', `admin:mat:toggle:${id}`).row();
  kb.text('← К материалам', 'admin:materials').row().text('🏠 Главное меню', 'admin:menu');
  await renderScreen(ctx, {
    text: `🎁 <b>${h(m.title)}</b>\nПометка: ${h(m.note)}\nСообщений: ${m.messages.length}\nСтатус: ${m.published ? 'опубликован' : 'черновик/отключён'}${m.published ? `\n\nСсылка для SMM-бота (скопируйте):\n<code>${h(materialLink(ctx, m.code))}</code>` : ''}`,
    keyboard: kb,
  });
}

async function draft(ctx: BotContext) {
  return BroadcastDraftModel.findOneAndUpdate(
    { ownerId: String(ctx.from!.id), status: 'draft' },
    { $setOnInsert: { ownerId: String(ctx.from!.id) } },
    { upsert: true, new: true, sort: { createdAt: -1 } },
  );
}
async function broadcastCard(ctx: BotContext) {
  await clearDialog(ctx);
  const d = await draft(ctx);
  const ids = await audienceIds(
    isAudience(d.audience) ? d.audience : 'all',
    ctx.config.ADMIN_EXPIRING_DAYS,
  );
  const kb = new InlineKeyboard()
    .text('➕ Добавить сообщение', 'admin:bc:add')
    .text('✏️ Сообщения', 'admin:bc:messages')
    .row()
    .text('👥 Выбрать аудиторию', 'admin:bc:audiences')
    .row()
    .text('👀 Предпросмотр', 'admin:bc:preview')
    .row()
    .text('🚀 К подтверждению', 'admin:bc:confirm')
    .row()
    .text('🏠 Главное меню', 'admin:menu');
  await renderScreen(ctx, {
    text: `📣 <b>Черновик рассылки</b>\nСообщений: ${d.messages.length}\nАудитория: ${h(AUDIENCES[isAudience(d.audience) ? d.audience : 'all'])}\nПолучателей: ${ids.length}\n\nЧерновик сохраняется автоматически.`,
    keyboard: kb,
  });
}
async function messageList(ctx: BotContext, scope: 'mat' | 'bc', id?: string) {
  const source = scope === 'mat' ? await MaterialModel.findById(id) : await draft(ctx);
  if (!source) return;
  const kb = new InlineKeyboard();
  source.messages.forEach((m, i) =>
    kb
      .text(
        `${i + 1}. ${m.kind} ${short(m.text || m.caption || '', 25)}`,
        `admin:edit:${scope}:${id || 'draft'}:${i}`,
      )
      .row(),
  );
  kb.text('➕ Добавить', scope === 'mat' ? `admin:mat:add:${id}` : 'admin:bc:add')
    .row()
    .text('← Назад', scope === 'mat' ? `admin:mat:open:${id}` : 'admin:broadcast');
  await renderScreen(ctx, {
    text: `✏️ Сообщения (${source.messages.length}). Выберите конкретное сообщение для правки.`,
    keyboard: kb,
  });
}
async function editCard(ctx: BotContext, scope: 'mat' | 'bc', id: string, index: number) {
  await clearDialog(ctx);
  const source = scope === 'mat' ? await MaterialModel.findById(id) : await draft(ctx);
  if (!source || !source.messages[index]) return;
  const item = source.messages[index];
  const base = `admin:edit:${scope}:${id}:${index}`;
  const kb = new InlineKeyboard().text('🔄 Заменить сообщение', `${base}:replace`).row();
  if (
    item.kind === 'text' ||
    item.caption !== undefined ||
    ['photo', 'video', 'document', 'audio', 'voice', 'animation'].includes(item.kind)
  )
    kb.text(
      item.kind === 'text' ? '✏️ Изменить текст' : '✏️ Изменить подпись',
      `${base}:text`,
    ).row();
  if (index > 0) kb.text('⬆️ Выше', `${base}:up`);
  if (index < source.messages.length - 1) kb.text('⬇️ Ниже', `${base}:down`);
  kb.row()
    .text('🗑 Удалить', `${base}:delete`)
    .row()
    .text('← К сообщениям', scope === 'mat' ? `admin:mat:messages:${id}` : 'admin:bc:messages');
  await renderScreen(ctx, {
    text: `Сообщение ${index + 1}: ${h(item.kind)}\n${h(short(item.text || item.caption || 'Без текста', 100))}\n\nДля замены медиа пришлите новое сообщение нужного формата.`,
    keyboard: kb,
  });
}

async function runBroadcast(bot: Bot<BotContext>, id: string) {
  while (true) {
    const d = await BroadcastDraftModel.findById(id);
    if (!d || d.status !== 'sending') return;
    if (d.cursor >= d.recipientIds.length) {
      const done = await BroadcastDraftModel.findOneAndUpdate(
        { _id: id, status: 'sending', cursor: { $gte: d.recipientIds.length } },
        { $set: { status: 'done' } },
        { new: true },
      );
      if (done)
        await bot.api.sendMessage(
          Number(done.ownerId),
          `✅ Рассылка завершена. Доставлено: ${done.sent}, ошибок: ${done.failed}, заблокировали бота: ${done.blocked}.`,
        );
      return;
    }
    // Claim before Telegram calls: a restart can skip one recipient, but cannot send twice.
    const claimed = await BroadcastDraftModel.findOneAndUpdate(
      { _id: id, status: 'sending', cursor: d.cursor },
      { $inc: { cursor: 1 } },
      { new: true },
    );
    if (!claimed) continue;
    const recipient = d.recipientIds[d.cursor]!;
    try {
      await sendContent(bot.api, Number(recipient), d.messages);
      await BroadcastDraftModel.updateOne({ _id: id }, { $inc: { sent: 1 } });
    } catch (error) {
      const blocked = error instanceof Error && /403|blocked by the user/i.test(error.message);
      await BroadcastDraftModel.updateOne(
        { _id: id },
        { $inc: blocked ? { failed: 1, blocked: 1 } : { failed: 1 } },
      );
      if (blocked)
        await UserModel.updateOne({ telegramId: recipient }, { $set: { isBlocked: true } });
    }
    if (d.cursor % 25 === 0)
      await bot.api
        .sendMessage(
          Number(d.ownerId),
          `📣 Рассылка: обработано ${d.cursor + 1}/${d.recipientIds.length}, доставлено ${claimed.sent}, ошибок ${claimed.failed}.`,
        )
        .catch(() => undefined);
    await sleep(50);
  }
}

export function registerAdminHandlers(bot: Bot<BotContext>): void {
  const admin = new AdminService();
  bot.command('admin', async (ctx) => {
    if (isAdmin(ctx)) {
      await clearDialog(ctx);
      await menu(ctx);
    }
  });
  bot.callbackQuery('admin:menu', async (ctx) => {
    if (isAdmin(ctx)) {
      await clearDialog(ctx);
      await menu(ctx);
    }
  });
  bot.callbackQuery('admin:stats', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const s = await admin.stats();
    const [unpaid, expiring] = await Promise.all([
      audienceIds('unpaid', ctx.config.ADMIN_EXPIRING_DAYS),
      audienceIds('expiring', ctx.config.ADMIN_EXPIRING_DAYS),
    ]);
    await renderScreen(ctx, {
      text: `📊 <b>Обзор</b>\nВсего пользователей: ${s.users}\nНовых сегодня: ${s.newToday}\nОплативших: ${await PaymentModel.distinct('telegramId', { status: 'succeeded' }).then((ids) => ids.length)}\nБез успешной оплаты: ${unpaid.length}\nАктивных подписок: ${s.active}\nСкоро закончится (за ${ctx.config.ADMIN_EXPIRING_DAYS} дн.): ${expiring.length}\nУспешных платежей: ${s.succeeded}\nВыручка: ${formatMoney(s.revenue)}`,
      keyboard: adminBackKeyboard(),
    });
  });
  bot.callbackQuery(
    /^admin:users(?::(started|unpaid|active|expiring|expired):([0-9]+))?$/,
    async (ctx) => {
      if (!isAdmin(ctx)) return;
      if (!ctx.match[1]) {
        const kb = new InlineKeyboard();
        (['started', 'unpaid', 'active', 'expiring', 'expired'] as Audience[]).forEach((a) =>
          kb.text(AUDIENCES[a], `admin:users:${a}:0`).row(),
        );
        kb.text('🏠 Главное меню', 'admin:menu');
        await renderScreen(ctx, {
          text: `👥 <b>Пользователи</b>\n«Скоро закончится» — ближайшие ${ctx.config.ADMIN_EXPIRING_DAYS} дней.`,
          keyboard: kb,
        });
        return;
      }
      const audience = ctx.match[1] as Audience;
      const ids = await audienceIds(audience, ctx.config.ADMIN_EXPIRING_DAYS);
      const pages = Math.max(1, Math.ceil(ids.length / 8));
      const page = Math.min(Number(ctx.match[2]), pages - 1);
      const users = await UserModel.find({ telegramId: { $in: ids } })
        .sort({ createdAt: -1 })
        .skip(page * 8)
        .limit(8);
      const kb = new InlineKeyboard();
      users.forEach((u) =>
        kb
          .text(
            `${short(u.firstName || u.username || u.telegramId, 22)} · ${u.telegramId}`,
            `admin:user:${u.telegramId}:${audience}:${page}`,
          )
          .row(),
      );
      if (page) kb.text('←', `admin:users:${audience}:${page - 1}`);
      if (page + 1 < pages) kb.text('→', `admin:users:${audience}:${page + 1}`);
      kb.row().text('← Категории', 'admin:users').row().text('🏠 Главное меню', 'admin:menu');
      await renderScreen(ctx, {
        text: `👥 <b>${AUDIENCES[audience]}</b>\n${ids.length} пользователей · страница ${page + 1}/${pages}`,
        keyboard: kb,
      });
    },
  );
  bot.callbackQuery(
    /^admin:user:([0-9]+):(started|unpaid|active|expiring|expired):([0-9]+)$/,
    async (ctx) => {
      if (!isAdmin(ctx)) return;
      const [id, audience, page] = ctx.match.slice(1) as [string, Audience, string];
      const u = await UserModel.findOne({ telegramId: id });
      if (!u) return;
      const [sub, last, paid] = await Promise.all([
        SubscriptionModel.findOne({ telegramId: id }),
        PaymentModel.findOne({ telegramId: id }).sort({ createdAt: -1 }),
        PaymentModel.countDocuments({ telegramId: id, status: 'succeeded' }),
      ]);
      const materials = await MaterialModel.find(
        { code: { $in: u.receivedMaterialCodes || [] } },
        { title: 1, code: 1 },
      );
      await renderScreen(ctx, {
        text: `👤 <b>${h([u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || id)}</b>\nID: <code>${id}</code>\nUsername: ${h(u.username ? '@' + u.username : '—')}\nПервый вход: ${date(u.createdAt)}\nПервый источник: ${h(u.firstSourceCode)}\nПоследний источник: ${h(u.lastSourceCode)}\nМатериалы: ${materials.length ? materials.map((m) => h(m.title)).join(', ') : '—'}\nУспешных платежей: ${paid}\nПоследний платёж: ${h(last?.status)}\nПодписка: ${h(sub?.status)}\nСрок: ${sub?.expiresAt === null ? 'бессрочно' : date(sub?.expiresAt)}`,
        keyboard: back(`admin:users:${audience}:${page}`),
      });
    },
  );
  bot.callbackQuery(/^admin:materials(?::([0-9]+))?$/, async (ctx) => {
    if (isAdmin(ctx)) await materialList(ctx, Number(ctx.match[1] || 0));
  });
  bot.callbackQuery('admin:mat:new', async (ctx) => {
    if (!isAdmin(ctx)) return;
    await setDialog(ctx, 'material_title_new');
    await renderScreen(ctx, {
      text: 'Пришлите название нового материала.',
      keyboard: cancel('admin:materials'),
    });
  });
  bot.callbackQuery(new RegExp(`^admin:mat:open:(${idPattern})$`), async (ctx) => {
    if (isAdmin(ctx)) await materialCard(ctx, ctx.match[1]!);
  });
  bot.callbackQuery(new RegExp(`^admin:mat:add:(${idPattern})$`), async (ctx) => {
    if (!isAdmin(ctx)) return;
    await setDialog(ctx, 'material_add', ctx.match[1]);
    await renderScreen(ctx, {
      text: 'Пришлите сообщение для материала. Можно отправить несколько подряд. Поддерживаются текст, фото, видео, документ/PDF, видеокружок, аудио, голосовое, анимация, стикер. Затем нажмите «Готово».',
      keyboard: new InlineKeyboard()
        .text('✅ Готово', `admin:mat:open:${ctx.match[1]}`)
        .row()
        .text('Отмена', `admin:mat:open:${ctx.match[1]}`),
    });
  });
  bot.callbackQuery(
    new RegExp(`^admin:mat:field:(title|note|inviteText|inviteButton):(${idPattern})$`),
    async (ctx) => {
      if (!isAdmin(ctx)) return;
      await setDialog(ctx, `material_field_${ctx.match[1]}`, ctx.match[2]);
      await renderScreen(ctx, {
        text: `Пришлите новое значение поля «${ctx.match[1]}». Для необязательных полей можно отправить «-», чтобы вернуть значение по умолчанию.`,
        keyboard: cancel(`admin:mat:open:${ctx.match[2]}`),
      });
    },
  );
  bot.callbackQuery(new RegExp(`^admin:mat:toggle:(${idPattern})$`), async (ctx) => {
    if (!isAdmin(ctx)) return;
    const m = await MaterialModel.findById(ctx.match[1]);
    if (!m) return;
    if (!m.published && !m.messages.length) {
      await renderScreen(ctx, {
        text: 'Нельзя опубликовать пустой материал. Добавьте хотя бы одно сообщение.',
        keyboard: back(`admin:mat:open:${m.id}`),
      });
      return;
    }
    m.published = !m.published;
    await m.save();
    await materialCard(ctx, m.id);
  });
  bot.callbackQuery(new RegExp(`^admin:mat:preview:(${idPattern})$`), async (ctx) => {
    if (!isAdmin(ctx)) return;
    const m = await MaterialModel.findById(ctx.match[1]);
    if (!m) return;
    await ctx.answerCallbackQuery();
    if (!m.messages.length) await ctx.reply('Материал пуст.');
    else {
      await sendContent(ctx.api, ctx.chat!.id, m.messages);
      await ctx.reply(m.inviteText || defaultInvite, {
        reply_markup: new InlineKeyboard().text(m.inviteButton || defaultButton, 'products'),
      });
    }
    await ctx.reply('Предпросмотр завершён.', { reply_markup: back(`admin:mat:open:${m.id}`) });
  });
  bot.callbackQuery(new RegExp(`^admin:mat:messages:(${idPattern})$`), async (ctx) => {
    if (isAdmin(ctx)) await messageList(ctx, 'mat', ctx.match[1]);
  });
  bot.callbackQuery('admin:broadcast', async (ctx) => {
    if (isAdmin(ctx)) {
      await clearDialog(ctx);
      await broadcastCard(ctx);
    }
  });
  bot.callbackQuery('admin:bc:add', async (ctx) => {
    if (!isAdmin(ctx)) return;
    await setDialog(ctx, 'broadcast_add');
    await renderScreen(ctx, {
      text: 'Пришлите сообщения рассылки по порядку. После добавления нажмите «Готово».',
      keyboard: new InlineKeyboard()
        .text('✅ Готово', 'admin:broadcast')
        .row()
        .text('Отмена', 'admin:broadcast'),
    });
  });
  bot.callbackQuery('admin:bc:messages', async (ctx) => {
    if (isAdmin(ctx)) await messageList(ctx, 'bc');
  });
  bot.callbackQuery('admin:bc:audiences', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const kb = new InlineKeyboard();
    (Object.keys(AUDIENCES) as Audience[]).forEach((a) =>
      kb.text(AUDIENCES[a], `admin:bc:audience:${a}`).row(),
    );
    kb.text('← Назад', 'admin:broadcast');
    await renderScreen(ctx, { text: 'Выберите аудиторию рассылки:', keyboard: kb });
  });
  bot.callbackQuery(
    /^admin:bc:audience:(all|started|unpaid|active|expiring|expired)$/,
    async (ctx) => {
      if (!isAdmin(ctx)) return;
      const d = await draft(ctx);
      d.audience = ctx.match[1]!;
      await d.save();
      await broadcastCard(ctx);
    },
  );
  bot.callbackQuery('admin:bc:preview', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const d = await draft(ctx);
    await ctx.answerCallbackQuery();
    if (!d.messages.length) await ctx.reply('Черновик пуст.');
    else await sendContent(ctx.api, ctx.chat!.id, d.messages);
    await ctx.reply('Предпросмотр завершён.', { reply_markup: back('admin:broadcast') });
  });
  bot.callbackQuery('admin:bc:confirm', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const d = await draft(ctx);
    if (!d.messages.length) {
      await renderScreen(ctx, {
        text: 'Нельзя отправить пустую рассылку.',
        keyboard: back('admin:broadcast'),
      });
      return;
    }
    const audience = isAudience(d.audience) ? d.audience : 'all';
    const ids = await audienceIds(audience, ctx.config.ADMIN_EXPIRING_DAYS);
    await renderScreen(ctx, {
      text: `Подтвердите рассылку.\nАудитория: <b>${h(AUDIENCES[audience])}</b>\nПолучателей: <b>${ids.length}</b>\nСообщений каждому: ${d.messages.length}\n\nПеред отправкой посмотрите предпросмотр.`,
      keyboard: new InlineKeyboard()
        .text('👀 Предпросмотр', 'admin:bc:preview')
        .row()
        .text('✅ Начать отправку', `admin:bc:send:${d.id}`)
        .row()
        .text('Отмена', 'admin:broadcast'),
    });
  });
  bot.callbackQuery(new RegExp(`^admin:bc:send:(${idPattern})$`), async (ctx) => {
    if (!isAdmin(ctx)) return;
    const d = await BroadcastDraftModel.findOne({
      _id: ctx.match[1],
      ownerId: String(ctx.from.id),
      status: 'draft',
    });
    if (!d || !d.messages.length) {
      await renderScreen(ctx, {
        text: 'Рассылка уже запущена или черновик пуст.',
        keyboard: adminBackKeyboard(),
      });
      return;
    }
    const ids = await audienceIds(
      isAudience(d.audience) ? d.audience : 'all',
      ctx.config.ADMIN_EXPIRING_DAYS,
    );
    const claimed = await BroadcastDraftModel.findOneAndUpdate(
      { _id: d.id, status: 'draft' },
      { $set: { status: 'sending', recipientIds: ids, cursor: 0 } },
      { new: true },
    );
    if (!claimed) {
      await ctx.answerCallbackQuery({ text: 'Рассылка уже запущена' });
      return;
    }
    await renderScreen(ctx, {
      text: `📣 Рассылка запущена для ${ids.length} пользователей. Итог придёт отдельным сообщением.`,
      keyboard: adminBackKeyboard(),
    });
    void runBroadcast(bot, d.id).catch((error: unknown) =>
      ctx.logger.error({ err: error }, 'Broadcast failed'),
    );
  });
  bot.callbackQuery(
    /^admin:edit:(mat|bc):([a-f0-9]{24}|draft):([0-9]+)(?::(replace|media|text|up|down|delete|delete_yes))?$/,
    async (ctx) => {
      if (!isAdmin(ctx)) return;
      const scope = ctx.match[1] as 'mat' | 'bc';
      const id = ctx.match[2]!;
      const index = Number(ctx.match[3]);
      const action = ctx.match[4];
      const source = scope === 'mat' ? await MaterialModel.findById(id) : await draft(ctx);
      if (!source || !source.messages[index]) return;
      if (action === 'replace' || action === 'media' || action === 'text') {
        if (action === 'text' && source.messages[index].kind === 'video_note') {
          await renderScreen(ctx, {
            text: 'У видеокружка нет подписи. Замените всё сообщение.',
            keyboard: back(`admin:edit:${scope}:${id}:${index}`),
          });
          return;
        }
        await setDialog(ctx, `${scope}_${action}`, scope === 'mat' ? id : undefined, index);
        await renderScreen(ctx, {
          text:
            action === 'replace'
              ? 'Пришлите новое сообщение. Старое останется до получения нового.'
              : action === 'media'
                ? 'Пришлите новое медиа. Существующая подпись сохранится.'
                : 'Пришлите новый текст или подпись. Для пустой подписи отправьте «-».',
          keyboard: cancel(`admin:edit:${scope}:${id}:${index}`),
        });
        return;
      }
      if (
        (action === 'up' && index > 0) ||
        (action === 'down' && index < source.messages.length - 1)
      ) {
        const other = action === 'up' ? index - 1 : index + 1;
        [source.messages[index], source.messages[other]] = [
          source.messages[other]!,
          source.messages[index],
        ];
        source.markModified('messages');
        await source.save();
        await editCard(ctx, scope, id, other);
        return;
      }
      if (action === 'delete') {
        await renderScreen(ctx, {
          text: `Удалить сообщение ${index + 1}? Черновик и остальные сообщения сохранятся.`,
          keyboard: new InlineKeyboard()
            .text('🗑 Да, удалить', `admin:edit:${scope}:${id}:${index}:delete_yes`)
            .row()
            .text('Отмена', `admin:edit:${scope}:${id}:${index}`),
        });
        return;
      }
      if (action === 'delete_yes') {
        source.messages.splice(index, 1);
        await source.save();
        await messageList(ctx, scope, id);
        return;
      }
      await editCard(ctx, scope, id, index);
    },
  );
  bot.on('message', async (ctx, next) => {
    if (!isAdmin(ctx) || !ctx.from || !ctx.message) {
      await next();
      return;
    }
    const dialog = await ownDialog(ctx);
    if (!dialog) {
      await next();
      return;
    }
    if (ctx.message.text?.startsWith('/')) {
      await next();
      return;
    }
    const mode = dialog.mode;
    const text = ctx.message.text;
    if (mode === 'material_title_new') {
      if (!text?.trim()) {
        await ctx.reply('Пришлите текстовое название.');
        return;
      }
      const m = await MaterialModel.create({
        code: `m_${randomBytes(12).toString('base64url')}`,
        title: text.trim().slice(0, 200),
        messages: [],
      });
      await clearDialog(ctx);
      await materialCard(ctx, m.id);
      return;
    }
    if (mode.startsWith('material_field_')) {
      if (!text) {
        await ctx.reply('Пришлите текст.');
        return;
      }
      const field = mode.slice('material_field_'.length);
      if (!['title', 'note', 'inviteText', 'inviteButton'].includes(field)) return;
      if (field === 'inviteText' && text.length > 4096) {
        await ctx.reply('Текст приглашения ограничен 4096 символами.');
        return;
      }
      if (field === 'inviteButton' && text.length > 64) {
        await ctx.reply('Название кнопки должно быть короче 64 символов.');
        return;
      }
      if (field === 'title' && text.trim() === '-') {
        await ctx.reply('Название не может быть пустым.');
        return;
      }
      await MaterialModel.updateOne(
        { _id: dialog.targetId },
        text.trim() === '-'
          ? { $unset: { [field]: 1 } }
          : { $set: { [field]: text.trim().slice(0, field === 'inviteText' ? 4096 : 200) } },
      );
      await clearDialog(ctx);
      await materialCard(ctx, dialog.targetId!);
      return;
    }
    const scope = mode.startsWith('material_') || mode.startsWith('mat_') ? 'mat' : 'bc';
    const source =
      scope === 'mat' ? await MaterialModel.findById(dialog.targetId) : await draft(ctx);
    if (!source) {
      await clearDialog(ctx);
      return;
    }
    if (mode.endsWith('_text')) {
      if (!text) {
        await ctx.reply('Пришлите текст.');
        return;
      }
      const index = dialog.index ?? -1;
      const item = source.messages[index];
      if (!item) return;
      if (item.kind !== 'text' && text.length > 1024) {
        await ctx.reply(
          'Подпись Telegram ограничена 1024 символами. Сократите текст или добавьте отдельное текстовое сообщение.',
        );
        return;
      }
      if (item.kind === 'text') {
        if (text.trim() === '-') {
          await ctx.reply('Текстовое сообщение не может быть пустым.');
          return;
        }
        item.text = text;
      } else item.caption = text.trim() === '-' ? '' : text;
      source.markModified('messages');
      await source.save();
      await clearDialog(ctx);
      await editCard(ctx, scope, scope === 'mat' ? dialog.targetId! : 'draft', index);
      return;
    }
    const item = contentFromMessage(ctx.message);
    if (!item) {
      await ctx.reply(
        'Этот формат нельзя скопировать. Пришлите текст, фото, видео, документ, видеокружок, аудио, голосовое, анимацию или стикер.',
      );
      return;
    }
    if (mode.endsWith('_media') && item.kind === 'text') {
      await ctx.reply('Пришлите медиа. Для текста используйте изменение текста.');
      return;
    }
    if (mode.endsWith('_replace') || mode.endsWith('_media')) {
      const index = dialog.index ?? -1;
      if (!source.messages[index]) return;
      const previousCaption = source.messages[index].caption;
      if (mode.endsWith('_media') && previousCaption !== undefined) item.caption = previousCaption;
      source.messages[index] = item;
      source.markModified('messages');
      await source.save();
      await clearDialog(ctx);
      await editCard(ctx, scope, scope === 'mat' ? dialog.targetId! : 'draft', index);
      return;
    }
    source.messages.push(item);
    await source.save();
    await ctx.reply(
      `✅ Добавлено сообщение ${source.messages.length}. Пришлите следующее или нажмите «Готово».`,
      {
        reply_markup: new InlineKeyboard()
          .text(
            '✅ Готово',
            scope === 'mat' ? `admin:mat:open:${dialog.targetId}` : 'admin:broadcast',
          )
          .row()
          .text(
            'Отмена',
            scope === 'mat' ? `admin:mat:open:${dialog.targetId}` : 'admin:broadcast',
          ),
      },
    );
  });
  bot.callbackQuery('admin:dev', async (ctx) => {
    if (!isAdmin(ctx) || ctx.config.NODE_ENV === 'production') return;
    const payments = await admin.pendingMockPayments();
    const kb = new InlineKeyboard();
    payments.forEach((p) =>
      kb.text(`✅ ${p.publicId.slice(0, 8)}`, `admin:mock:success:${p.id}`).row(),
    );
    kb.text('← Назад', 'admin:menu');
    await renderScreen(ctx, {
      text: payments.length ? '🧪 Выберите mock-платёж:' : 'Нет ожидающих mock-платежей.',
      keyboard: kb,
    });
  });
  bot.callbackQuery(new RegExp(`^admin:mock:success:(${idPattern})$`), async (ctx) => {
    if (!isAdmin(ctx) || ctx.config.NODE_ENV === 'production') return;
    const result = await ctx.services.payments.processSuccessAfterMock(ctx.match[1]!);
    if (result) {
      const invite = await ctx.services.access.getOrCreateValidInvite(result.subscription);
      const kb = new InlineKeyboard();
      if (invite) kb.url('👉 Вступить в закрытый клуб', invite);
      await bot.api
        .sendMessage(
          Number(result.payment.telegramId),
          '🎉 Оплата прошла! Добро пожаловать в клуб 💛',
          { reply_markup: kb },
        )
        .catch(() => undefined);
    }
    await renderScreen(ctx, {
      text: result ? '✅ Mock-платёж подтверждён.' : 'Платёж уже обработан или недоступен.',
      keyboard: adminBackKeyboard(),
    });
  });
}

export async function resumeBroadcasts(bot: Bot<BotContext>, logger: Logger) {
  const sending = await BroadcastDraftModel.find({ status: 'sending' });
  for (const item of sending) {
    const unaccounted = Math.max(0, item.cursor - item.sent - item.failed);
    if (unaccounted)
      await BroadcastDraftModel.updateOne({ _id: item.id }, { $inc: { failed: unaccounted } });
    void runBroadcast(bot, item.id).catch((error: unknown) =>
      logger.error({ err: error, broadcastId: item.id }, 'Broadcast resume failed'),
    );
  }
}
