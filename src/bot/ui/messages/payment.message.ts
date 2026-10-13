import type { Product } from '../../../config/products.js';
import { formatMoney } from '../helpers/formatMoney.js';
export const productMessage = (
  product: Product,
  checkoutAvailable = true,
) => `🍳 <b>Доступ в клуб</b>

<b>${product.title}</b>

✓ все материалы клуба
✓ меню и рецепты
✓ заготовки
✓ новые материалы
✓ закрытая Telegram-группа

Стоимость: <b>${formatMoney(product.price)}</b>
Доступ: <b>${product.durationDays === null ? 'навсегда' : `${product.durationDays} дней`}</b>

${checkoutAvailable ? 'Нажимая «Перейти к оплате», вы соглашаетесь с публичной офертой и политикой обработки персональных данных.' : 'Оплата откроется после запуска клуба. Сейчас можно ознакомиться с условиями и документами.'}`;
