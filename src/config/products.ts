export interface Product {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  durationDays: number | null;
  price: number;
  currency: 'RUB';
  active: boolean;
  receiptDescription: string;
}

// REPLACE WITH REAL BUSINESS VALUES before production launch.
export const products: readonly Product[] = [
  {
    id: 'monthly',
    title: '1 месяц',
    shortDescription: 'Доступ на 30 дней',
    description: 'Полный доступ ко всем материалам клуба',
    durationDays: 30,
    price: 99000,
    currency: 'RUB',
    active: true,
    receiptDescription: 'Доступ в кулинарный клуб на 30 дней',
  },
  {
    id: 'quarterly',
    title: '3 месяца',
    shortDescription: 'Доступ на 90 дней',
    description: 'Полный доступ ко всем материалам клуба',
    durationDays: 90,
    price: 249000,
    currency: 'RUB',
    active: true,
    receiptDescription: 'Доступ в кулинарный клуб на 90 дней',
  },
  {
    id: 'lifetime',
    title: 'Навсегда',
    shortDescription: 'Бессрочный доступ',
    description: 'Полный бессрочный доступ ко всем материалам клуба',
    durationDays: null,
    price: 799000,
    currency: 'RUB',
    active: false,
    receiptDescription: 'Бессрочный доступ в кулинарный клуб',
  },
];

export const getProduct = (id: string) =>
  products.find((product) => product.id === id && product.active);
export const getActiveProducts = () => products.filter((product) => product.active);
