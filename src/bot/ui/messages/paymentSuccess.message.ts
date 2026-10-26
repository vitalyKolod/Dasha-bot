import type { PaymentPurpose } from '../../../modules/payments/payment.model.js';
import { formatDate, formatDateTime } from '../helpers/formatDate.js';

export const paymentSuccessMessage = (purpose: PaymentPurpose, expiresAt: Date | null) =>
  purpose === 'renewal'
    ? `🎉 <b>Оплата прошла!</b>\n\n✅ Доступ продлён до <b>${expiresAt ? formatDateTime(expiresAt) : 'бессрочно'}</b>.\n\n📅 Следующее продление можно оплатить до <b>${expiresAt ? formatDateTime(expiresAt) : 'окончания доступа'}</b>. Стоимость — <b>1 000 ₽</b>. Автоматического списания нет.`
    : `🎉 <b>Оплата прошла!</b>\n\nДобро пожаловать в клуб 💛\n\nТвой доступ активен: <b>${expiresAt ? `до ${formatDate(expiresAt)}` : 'навсегда'}</b>`;
