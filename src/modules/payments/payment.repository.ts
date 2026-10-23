import { PaymentModel, type PaymentStatus } from './payment.model.js';

export class PaymentRepository {
  create(data: Parameters<typeof PaymentModel.create>[0]) {
    return PaymentModel.create(data);
  }
  findByPublicId(publicId: string) {
    return PaymentModel.findOne({ publicId });
  }
  findByInvoice(provider: string, invoice: string) {
    return PaymentModel.findOne({ provider, providerInvoiceId: invoice });
  }
  findById(id: string) {
    return PaymentModel.findById(id);
  }
  listLatest(limit = 10) {
    return PaymentModel.find().sort({ createdAt: -1 }).limit(limit);
  }
  listPendingMock(limit = 10) {
    return PaymentModel.find({ provider: 'mock', status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
  async setCheckout(
    id: string,
    checkoutUrl: string,
    providerInvoiceId: string,
    providerPaymentId?: string,
  ) {
    return PaymentModel.findByIdAndUpdate(
      id,
      { $set: { checkoutUrl, providerInvoiceId, providerPaymentId, status: 'pending' } },
      { new: true },
    ).orFail();
  }
  setStatus(id: string, status: PaymentStatus, metadata?: Record<string, unknown>) {
    return PaymentModel.findByIdAndUpdate(
      id,
      { $set: { status, providerMetadata: metadata } },
      { new: true },
    ).orFail();
  }
  claimForProcessing(id: string) {
    return PaymentModel.findOneAndUpdate(
      { _id: id, status: 'succeeded', processedAt: { $exists: false } },
      { $set: { processedAt: new Date() } },
      { new: true },
    );
  }
  releaseProcessing(id: string) {
    return PaymentModel.updateOne({ _id: id }, { $unset: { processedAt: 1 } });
  }
  claimDelivery(now = new Date()) {
    return PaymentModel.findOneAndUpdate(
      {
        provider: 'robokassa',
        status: 'succeeded',
        processedAt: { $exists: true },
        $or: [
          { deliveryStatus: 'pending' },
          { deliveryStatus: 'retry', nextDeliveryAttemptAt: { $lte: now } },
          { deliveryStatus: 'sending', deliveryLeaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { deliveryStatus: 'sending', deliveryLeaseUntil: new Date(now.getTime() + 120_000) },
        $inc: { deliveryAttempts: 1 },
      },
      { new: true, sort: { createdAt: 1 } },
    );
  }
  markDelivered(id: string) {
    return PaymentModel.updateOne(
      { _id: id, deliveryStatus: 'sending' },
      {
        $set: { deliveryStatus: 'sent', deliveredAt: new Date() },
        $unset: { deliveryLeaseUntil: 1 },
      },
    );
  }
  retryDelivery(id: string, attempts: number) {
    const delay = Math.min(5_000 * 2 ** Math.min(attempts - 1, 6), 300_000);
    return PaymentModel.updateOne(
      { _id: id, deliveryStatus: 'sending' },
      {
        $set: { deliveryStatus: 'retry', nextDeliveryAttemptAt: new Date(Date.now() + delay) },
        $unset: { deliveryLeaseUntil: 1 },
      },
    );
  }
  listUnprocessedSucceeded(limit = 20) {
    return PaymentModel.find({ status: 'succeeded', processedAt: { $exists: false } })
      .sort({ createdAt: 1 })
      .limit(limit);
  }
  countSucceeded() {
    return PaymentModel.countDocuments({ status: 'succeeded' });
  }
  countSucceededSince(date: Date) {
    return PaymentModel.countDocuments({ status: 'succeeded', createdAt: { $gte: date } });
  }
  revenue() {
    return PaymentModel.aggregate<{ total: number }>([
      { $match: { status: 'succeeded' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  }
}
