import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
export type SubscriptionStatus = 'active' | 'expired' | 'canceled';
export interface Subscription {
  userId: Types.ObjectId;
  telegramId: string;
  productId: string;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date | null;
  lastPaymentId: Types.ObjectId;
  accessGrantedAt?: Date;
  accessRemovedAt?: Date;
  accessRemovalPendingAt?: Date;
  reminder3DaysSentAt?: Date;
  reminder1DaySentAt?: Date;
  expirationNotificationSentAt?: Date;
  inviteLink?: string;
  inviteRequiresApproval?: boolean;
  inviteLinkExpiresAt?: Date;
  inviteLinks?: { url: string; expiresAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<Subscription>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    telegramId: { type: String, required: true, unique: true },
    productId: { type: String, required: true },
    status: { type: String, enum: ['active', 'expired', 'canceled'], required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, default: null },
    lastPaymentId: { type: Schema.Types.ObjectId, required: true, ref: 'Payment' },
    accessGrantedAt: Date,
    accessRemovedAt: Date,
    accessRemovalPendingAt: Date,
    reminder3DaysSentAt: Date,
    reminder1DaySentAt: Date,
    expirationNotificationSentAt: Date,
    inviteLink: String,
    inviteRequiresApproval: Boolean,
    inviteLinkExpiresAt: Date,
    inviteLinks: [
      { url: { type: String, required: true }, expiresAt: { type: Date, required: true } },
    ],
  },
  { timestamps: true },
);
schema.index({ status: 1, expiresAt: 1 });
export type SubscriptionDocument = HydratedDocument<Subscription>;
export const SubscriptionModel = model<Subscription>('Subscription', schema);
