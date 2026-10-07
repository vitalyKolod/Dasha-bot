import { UserModel } from '../users/user.model.js';
import { PaymentModel } from '../payments/payment.model.js';
import { SubscriptionModel } from '../subscriptions/subscription.model.js';

export const AUDIENCES = {
  all: 'Все пользователи',
  started: 'Начали бота',
  unpaid: 'Не оплатили',
  active: 'Активная подписка',
  expiring: 'Скоро закончится',
  expired: 'Закончилась',
} as const;
export type Audience = keyof typeof AUDIENCES;
export const isAudience = (value: string): value is Audience => value in AUDIENCES;

export async function audienceIds(audience: Audience, expiringDays: number, now = new Date()) {
  const users = await UserModel.find({}, { telegramId: 1 }).lean();
  if (audience === 'all' || audience === 'started') return users.map((u) => u.telegramId);
  const ids = users.map((u) => u.telegramId);
  if (audience === 'unpaid') {
    const paid = await PaymentModel.distinct('telegramId', {
      status: 'succeeded',
      telegramId: { $in: ids },
    });
    const paidSet = new Set(paid);
    return ids.filter((id) => !paidSet.has(id));
  }
  const until = new Date(now.getTime() + expiringDays * 86400000);
  if (audience === 'active')
    return SubscriptionModel.distinct('telegramId', {
      telegramId: { $in: ids },
      status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
  if (audience === 'expiring')
    return SubscriptionModel.distinct('telegramId', {
      telegramId: { $in: ids },
      status: 'active',
      expiresAt: { $gt: now, $lte: until },
    });
  return SubscriptionModel.distinct('telegramId', {
    telegramId: { $in: ids },
    $or: [{ status: { $ne: 'active' } }, { expiresAt: { $lte: now } }],
  });
}
