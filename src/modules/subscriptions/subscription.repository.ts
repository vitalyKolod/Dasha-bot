import type { ClientSession } from 'mongoose';
import { SubscriptionModel } from './subscription.model.js';
import type { ReminderField } from '../reminders/reminder.logic.js';
export class SubscriptionRepository {
  findByTelegramId(telegramId: string, session?: ClientSession) {
    return SubscriptionModel.findOne({ telegramId }).session(session ?? null);
  }
  findActive(telegramId: string, now = new Date()) {
    return SubscriptionModel.findOne({
      telegramId,
      status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
  }
  upsert(
    data: {
      userId: unknown;
      telegramId: string;
      productId: string;
      startedAt: Date;
      expiresAt: Date | null;
      lastPaymentId: unknown;
    },
    session?: ClientSession,
  ) {
    return SubscriptionModel.findOneAndUpdate(
      { telegramId: data.telegramId },
      {
        $set: { ...data, status: 'active' },
        $unset: {
          reminder3DaysSentAt: 1,
          reminder2DaysSentAt: 1,
          reminder1DaySentAt: 1,
          reminderTodaySentAt: 1,
          expirationNotificationSentAt: 1,
          accessGrantedAt: 1,
          accessRemovedAt: 1,
        },
      },
      { upsert: true, new: true, ...(session ? { session } : {}) },
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
  listExpiredNeedingRemoval(limit = 50) {
    return SubscriptionModel.find({ status: 'expired', accessRemovedAt: { $exists: false } })
      .sort({ expiresAt: 1 })
      .limit(limit);
  }
  markAccessRemoved(id: string) {
    return SubscriptionModel.updateOne(
      { _id: id, status: 'expired' },
      { $set: { accessRemovedAt: new Date() }, $unset: { accessRemovalPendingAt: 1 } },
    );
  }
  markAccessRemovalPending(id: string) {
    return SubscriptionModel.findOneAndUpdate(
      { _id: id, status: 'expired', accessRemovedAt: { $exists: false } },
      { $set: { accessRemovalPendingAt: new Date() } },
      { new: true },
    );
  }
  clearAccessRemovalPending(telegramId: string) {
    return SubscriptionModel.updateOne({ telegramId }, { $unset: { accessRemovalPendingAt: 1 } });
  }
  clearInvite(telegramId: string, link: string) {
    return SubscriptionModel.findOneAndUpdate(
      { telegramId, $or: [{ inviteLink: link }, { 'inviteLinks.url': link }] },
      {
        $set: { accessGrantedAt: new Date() },
        $unset: {
          inviteLink: 1,
          inviteLinkExpiresAt: 1,
          inviteRequiresApproval: 1,
          inviteLinks: 1,
        },
      },
    );
  }
  expireAtomically(id: string, now = new Date()) {
    return SubscriptionModel.findOneAndUpdate(
      { _id: id, status: 'active', expiresAt: { $lte: now } },
      { $set: { status: 'expired' } },
      { new: true },
    );
  }
  claimReminder(id: string, field: ReminderField, expiresAt?: Date) {
    return SubscriptionModel.findOneAndUpdate(
      {
        _id: id,
        status: field === 'expirationNotificationSentAt' ? 'expired' : 'active',
        ...(expiresAt ? { expiresAt } : {}),
        [field]: { $exists: false },
      },
      { $set: { [field]: new Date() } },
      { new: true },
    );
  }
  releaseReminder(id: string, field: ReminderField, expiresAt: Date) {
    return SubscriptionModel.updateOne(
      {
        _id: id,
        expiresAt,
        status: field === 'expirationNotificationSentAt' ? 'expired' : 'active',
      },
      { $unset: { [field]: 1 } },
    );
  }
  listActiveExpiringBetween(from: Date, to: Date) {
    return SubscriptionModel.find({ status: 'active', expiresAt: { $gte: from, $lte: to } });
  }
}
