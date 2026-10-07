import { SubscriptionModel } from './subscription.model.js';
export class SubscriptionRepository {
  findByTelegramId(telegramId: string) {
    return SubscriptionModel.findOne({ telegramId });
  }
  findActive(telegramId: string, now = new Date()) {
    return SubscriptionModel.findOne({
      telegramId,
      status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
  }
  upsert(data: {
    userId: unknown;
    telegramId: string;
    productId: string;
    startedAt: Date;
    expiresAt: Date | null;
    lastPaymentId: unknown;
  }) {
    return SubscriptionModel.findOneAndUpdate(
      { telegramId: data.telegramId },
      {
        $set: { ...data, status: 'active' },
        $unset: { reminder3DaysSentAt: 1, reminder1DaySentAt: 1, expirationNotificationSentAt: 1 },
      },
      { upsert: true, new: true },
    ).orFail();
  }
  countActive(now = new Date()) {
    return SubscriptionModel.countDocuments({
      status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
  }
  listDueForExpiration(now: Date) {
    return SubscriptionModel.find({ status: 'active', expiresAt: { $ne: null, $lte: now } });
  }
  expireAtomically(id: string) {
    return SubscriptionModel.findOneAndUpdate(
      { _id: id, status: 'active' },
      { $set: { status: 'expired' } },
      { new: true },
    );
  }
  claimReminder(
    id: string,
    field: 'reminder3DaysSentAt' | 'reminder1DaySentAt' | 'expirationNotificationSentAt',
  ) {
    return SubscriptionModel.findOneAndUpdate(
      { _id: id, [field]: { $exists: false } },
      { $set: { [field]: new Date() } },
      { new: true },
    );
  }
  listActiveExpiringBetween(from: Date, to: Date) {
    return SubscriptionModel.find({ status: 'active', expiresAt: { $gte: from, $lte: to } });
  }
}
