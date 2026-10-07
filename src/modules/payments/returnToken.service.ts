import type { Types } from 'mongoose';
import { PaymentReturnTokenModel } from './paymentReturnToken.model.js';
import { createSecureToken, hashToken } from '../../shared/utils/crypto.js';

export class ReturnTokenService {
  constructor(private readonly ttlMinutes: number) {}
  async create(paymentId: Types.ObjectId) {
    const token = createSecureToken();
    await PaymentReturnTokenModel.create({
      paymentId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + this.ttlMinutes * 60_000),
    });
    return token;
  }
  async resolve(token: string, consume = false) {
    const query = {
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
      consumedAt: { $exists: false },
    };
    if (!consume) return PaymentReturnTokenModel.findOne(query);
    return PaymentReturnTokenModel.findOneAndUpdate(
      query,
      { $set: { consumedAt: new Date() } },
      { new: true },
    );
  }
}
