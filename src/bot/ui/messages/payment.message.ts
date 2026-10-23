import type { Product } from '../../../config/products.js';
import { formatMoney } from '../helpers/formatMoney.js';
export const productMessage = (
  product: Product,
  checkoutAvailable = true,
  renewal = false,
) => `🍳 <b>Доступ в клуб</b>

<b>${renewal ? 'Продление на 1 месяц' : product.title}</b>

✓ все материалы клуба
✓ меню и рецепты
✓ заготовки
✓ новые материалы
✓ закрытая Telegram-группа

Стоимость: <b>${formatMoney(renewal ? 100000 : product.price)}</b>
Доступ: <b>${product.durationDays === null ? 'навсегда' : `${product.durationDays} дней`}</b>
${renewal ? 'Цена 1 000 ₽ сохраняется и после перерыва в подписке.' : 'После первой оплаты продление стоит 1 000 ₽ за каждые 30 дней. Эта цена сохраняется и после перерыва.'}

${checkoutAvailable ? 'Нажимая «Перейти к оплате», вы соглашаетесь с публичной офертой и политикой обработки персональных данных.' : 'Оплата откроется после запуска клуба. Сейчас можно ознакомиться с условиями и документами.'}`;
