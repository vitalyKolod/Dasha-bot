import { InlineKeyboard, InputFile, type Bot } from 'grammy';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { BotContext } from '../context.js';
import { getActiveProducts, getProduct } from '../../config/products.js';
import { formatMoney } from '../ui/helpers/formatMoney.js';
import { renderScreen } from '../ui/renderScreen.js';

export function registerLegalHandler(bot: Bot<BotContext>): void {
  const localDocumentsDir = fileURLToPath(new URL('../../../assets/legal/', import.meta.url));
  const documents = {
    offer: {
      filename: 'public-offer.pdf',
      name: 'Публичная оферта.pdf',
    },
    license: {
      filename: 'license-agreement.pdf',
      name: 'Лицензионное соглашение.pdf',
    },
    privacy: {
      filename: 'privacy-policy.pdf',
      name: 'Политика обработки персональных данных.pdf',
    },
    consent: {
      filename: 'personal-data-consent.pdf',
      name: 'Согласие на обработку персональных данных.pdf',
    },
  };
  bot.callbackQuery(/^legal-document:(offer|license|privacy|consent)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const document = documents[ctx.match[1] as keyof typeof documents];
    await ctx.replyWithDocument(
      new InputFile(
        join(ctx.config.LEGAL_DOCUMENTS_DIR ?? localDocumentsDir, document.filename),
        document.name,
      ),
    );
  });
  bot.callbackQuery(/^legal(?::([a-z0-9_-]+))?$/, async (ctx) => {
    const returnTo = ctx.match[1];
    const product = returnTo ? getProduct(returnTo) : undefined;
    const keyboard = new InlineKeyboard();
    keyboard.text('📄 Публичная оферта', 'legal-document:offer').row();
    keyboard.text('📄 Лицензионное соглашение', 'legal-document:license').row();
    keyboard.text('📄 Политика обработки данных', 'legal-document:privacy').row();
    keyboard.text('📄 Согласие на обработку данных', 'legal-document:consent').row();
    if (returnTo) keyboard.text('← К тарифу', `product:${returnTo}`).row();
    keyboard.text('🏠 Главное меню', 'menu');
    await renderScreen(ctx, {
      text: [
        '📄 <b>Информация и условия</b>',
        product
          ? `<b>Тариф «${product.title}»</b>\nСтоимость: <b>${formatMoney(product.price)}</b>\nДоступ: <b>${product.durationDays === null ? 'навсегда' : `${product.durationDays} дней`}</b>`
          : `<b>Тарифы</b>\n${getActiveProducts()
              .map(
                (item) =>
                  `«${item.title}» — ${formatMoney(item.price)}, доступ ${item.durationDays === null ? 'навсегда' : `на ${item.durationDays} дней`}`,
              )
              .join('\n')}`,
        'Первый доступ: 2 000 ₽ за 30 дней или 3 000 ₽ за 90 дней. После первой оплаты продление на 30 дней стоит 1 000 ₽, даже если подписка прерывалась.',
        'После оплаты ты получишь доступ в закрытую Telegram-группу клуба: ко всем рецептам, заготовкам, меню, спискам продуктов и новым материалам.',
        'Подробные условия покупки и обработки данных — в документах ниже.',
      ].join('\n\n'),
      keyboard,
    });
  });
}
