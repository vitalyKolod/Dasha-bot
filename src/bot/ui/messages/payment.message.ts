import type { Product } from '../../../config/products.js';
import { formatMoney } from '../helpers/formatMoney.js';
export const productMessage = (product: Product) => `🍳 <b>Доступ в клуб</b>

<b>${product.title}</b>

✓ все материалы клуба
✓ меню и рецепты
✓ заготовки
✓ новые материалы
✓ закрытая Telegram-группа

Стоимость: <b>${formatMoney(product.price)}</b>
Доступ: <b>${product.durationDays === null ? 'навсегда' : `${product.durationDays} дней`}</b>

Нажимая «Перейти к оплате», вы соглашаетесь с публичной офертой и политикой обработки персональных данных.`;
