import { InlineKeyboard, InputFile, type Bot } from 'grammy';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { BotContext } from '../context.js';
import { legal } from '../../config/legal.js';
import { escapeHtml } from '../ui/helpers/escapeHtml.js';
import { renderScreen } from '../ui/renderScreen.js';

const section = (title: string, value: string) =>
  value.trim() ? `<b>${title}</b>\n${escapeHtml(value.trim())}` : null;

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
    const sellerInn = ctx.config.LEGAL_SELLER_INN ?? legal.sellerInn;
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
        section(
          'Продавец и реквизиты',
          [
            ctx.config.LEGAL_SELLER_NAME ?? legal.sellerName,
            sellerInn ? `ИНН исполнителя: ${sellerInn}` : '',
            ctx.config.LEGAL_BANK_DETAILS ?? legal.bankDetails,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
        section('Контакты', ctx.config.LEGAL_CONTACTS ?? legal.contacts),
        section('Оформление заказа и сроки', legal.order),
        section('Оплата', legal.payment),
        section('Предоставление доступа', legal.delivery),
        section('Отказ от покупки', legal.cancellation),
        section('Возврат средств: обращение', legal.refundRequest),
        section('Возврат средств: рассмотрение и сроки', legal.refundProcessing),
        section('Обработка персональных данных', legal.personalData),
      ]
        .filter(Boolean)
        .join('\n\n'),
      keyboard,
    });
  });
}
