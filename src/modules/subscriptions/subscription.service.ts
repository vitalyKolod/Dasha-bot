import type { PaymentDocument } from '../payments/payment.model.js';
import { getProduct } from '../../config/products.js';
import { AppError } from '../../shared/errors/AppError.js';
import { calculateNewExpiry } from './subscription.logic.js';
import { SubscriptionRepository } from './subscription.repository.js';

export class SubscriptionService {
  constructor(private readonly subscriptions = new SubscriptionRepository()) {}
  async activate(payment: PaymentDocument) {
    const product = getProduct(payment.productId);
    if (!product) throw new AppError('Product no longer exists', 409, 'PRODUCT_NOT_FOUND');
    const now = new Date();
    const existing = await this.subscriptions.findByTelegramId(payment.telegramId);
    const expiresAt = calculateNewExpiry(now, existing?.expiresAt, product.durationDays);
    return this.subscriptions.upsert({
      userId: payment.userId,
      telegramId: payment.telegramId,
      productId: payment.productId,
      startedAt: existing?.startedAt ?? now,
      expiresAt,
      lastPaymentId: payment._id,
    });
  }
  getActive(telegramId: string) {
    return this.subscriptions.findActive(telegramId);
  }
  get(telegramId: string) {
    return this.subscriptions.findByTelegramId(telegramId);
  }
}
