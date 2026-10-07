import { Schema, model, type Types } from 'mongoose';

export interface PaymentReturnToken {
  paymentId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
}
const schema = new Schema<PaymentReturnToken>(
  {
    paymentId: { type: Schema.Types.ObjectId, required: true, ref: 'Payment', index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const PaymentReturnTokenModel = model<PaymentReturnToken>('PaymentReturnToken', schema);
