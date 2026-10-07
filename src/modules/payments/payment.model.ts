import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type PaymentStatus =
  'created' | 'pending' | 'succeeded' | 'canceled' | 'failed' | 'refunded';
export type PaymentPurpose = 'new_subscription' | 'renewal';

export interface Payment {
  publicId: string;
  userId: Types.ObjectId;
  telegramId: string;
  productId: string;
  amount: number;
  currency: string;
  provider: string;
  providerPaymentId?: string;
  providerInvoiceId?: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  checkoutUrl?: string;
  termsAcceptedAt: Date;
  offerVersion: string;
  processedAt?: Date;
  providerMetadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<Payment>(
  {
    publicId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    telegramId: { type: String, required: true },
    productId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    provider: { type: String, required: true },
    providerPaymentId: String,
    providerInvoiceId: String,
    status: {
      type: String,
      required: true,
      enum: ['created', 'pending', 'succeeded', 'canceled', 'failed', 'refunded'],
      default: 'created',
    },
    purpose: { type: String, required: true, enum: ['new_subscription', 'renewal'] },
    checkoutUrl: String,
    termsAcceptedAt: { type: Date, required: true },
    offerVersion: { type: String, required: true },
    processedAt: Date,
    providerMetadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);
schema.index({ provider: 1, providerPaymentId: 1 }, { unique: true, sparse: true });
schema.index({ provider: 1, providerInvoiceId: 1 }, { unique: true, sparse: true });
schema.index({ status: 1 });
schema.index({ telegramId: 1, createdAt: -1 });
export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentModel = model<Payment>('Payment', schema);
