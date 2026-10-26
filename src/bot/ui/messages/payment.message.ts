import type { Product } from '../../../config/products.js';
import { formatMoney } from '../helpers/formatMoney.js';

const firstAccessSelection = `🍳 <b>Выберите доступ в клуб</b>

🥕 Рецепты, меню и закрытая группа

🔁 После первой покупки — <b>1 000 ₽ / месяц</b>
<i>Цена сохраняется после перерыва.</i>

👇 Выберите срок первого доступа`;

const renewalSelection = `💛 <b>Продление доступа</b>

🔁 Продление — <b>1 000 ₽ / 30 дней</b>
<i>Цена сохраняется после перерыва.</i>

👇 Продлите доступ`;

export const salesOpeningNotice =
  '⏳ Продажи откроются завтра. Пока можно посмотреть тарифы и условия.';

export const productSelectionMessage = (renewal: boolean, testMode = false) =>
  `${testMode ? '🧪 <b>Тестовая оплата</b> · деньги не списываются\n\n' : ''}${renewal ? renewalSelection : firstAccessSelection}`;

export const productMessage = (
  product: Product,
  checkoutAvailable = true,
  renewal = false,
) => `🍳 <b>Клуб Даши · ${renewal ? 'продление' : product.title}</b>

🥕 Рецепты, меню и заготовки
✨ Новые материалы
🔒 Закрытая Telegram-группа

💰 Стоимость: <b>${formatMoney(renewal ? 100000 : product.price)}</b>
⏳ Доступ: <b>${product.durationDays === null ? 'навсегда' : `${product.durationDays} дней`}</b>

${renewal ? '💛 <i>Цена 1 000 ₽ сохраняется после перерыва.</i>' : '🔁 Следующий месяц — <b>1 000 ₽</b>\n<i>Цена сохраняется после перерыва.</i>'}

${checkoutAvailable ? '<i>Нажимая «Перейти к оплате», вы соглашаетесь с публичной офертой и политикой обработки персональных данных.</i>' : salesOpeningNotice}`;
