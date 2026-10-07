import { randomInt, randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { Types } from 'mongoose';
import type { AppConfig } from '../../config/env.js';
import { getProduct } from '../../config/products.js';
import { AppError } from '../../shared/errors/AppError.js';
import type { PaymentProvider } from './PaymentProvider.js';
import { PaymentRepository } from './payment.repository.js';
import { ReturnTokenService } from './returnToken.service.js';
import { SubscriptionService } from '../subscriptions/subscription.service.js';
import type { VerifiedWebhookEvent } from './payment.types.js';
import { moneyEquals } from './payment.logic.js';

export class PaymentService {
  readonly returnTokens: ReturnTokenService;
  constructor(
    private readonly provider: PaymentProvider,
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly payments = new PaymentRepository(),
    private readonly subscriptions = new SubscriptionService(),
  ) {
    this.returnTokens = new ReturnTokenService(config.PAYMENT_RETURN_TOKEN_TTL_MINUTES);
  }
  async createCheckout(input: {
    userId: Types.ObjectId;
    telegramId: string;
    productId: string;
    renewal: boolean;
  }) {
    const product = getProduct(input.productId);
    if (!product) throw new AppError('Тариф недоступен', 404, 'PRODUCT_NOT_FOUND');
    let payment: Awaited<ReturnType<PaymentRepository['create']>> | undefined;
    let invoiceId = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      invoiceId = String(randomInt(1, 2_000_000_000));
      try {
        payment = await this.payments.create({
          providerInvoiceId: invoiceId,
          ...(this.provider.name === 'robokassa' ? { providerPaymentId: invoiceId } : {}),
          publicId: randomUUID(),
          userId: input.userId,
          telegramId: input.telegramId,
          productId: product.id,
          amount: product.price,
          currency: product.currency,
          provider: this.provider.name,
          status: 'created',
          purpose: input.renewal ? 'renewal' : 'new_subscription',
          termsAcceptedAt: new Date(),
          offerVersion: this.config.OFFER_VERSION,
        });
        break;
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 11000) throw error;
      }
    }
    if (!payment)
      throw new AppError('Could not allocate invoice', 503, 'INVOICE_ALLOCATION_FAILED');
    const token = await this.returnTokens.create(payment._id);
    const checkout = await this.provider.createCheckout({
      paymentId: payment.publicId,
      invoiceId,
      amount: payment.amount,
      currency: payment.currency,
      description: product.receiptDescription,
      returnUrl:
        this.provider.name === 'mock'
          ? `${this.config.APP_BASE_URL}/payment/return?token=${encodeURIComponent(token)}`
          : `${this.config.PUBLIC_BASE_URL}/api/payments/robokassa/success`,
    });
    const updated = await this.payments.setCheckout(
      String(payment._id),
      checkout.checkoutUrl,
      checkout.providerInvoiceId,
      checkout.providerPaymentId,
    );
    this.logger.info(
      {
        payment: updated.publicId,
        telegramId: input.telegramId,
        product: product.id,
        amount: product.price,
        currency: product.currency,
      },
      '💳 PAYMENT CREATED',
    );
    return { payment: updated, token };
  }
  async handleVerifiedEvent(event: VerifiedWebhookEvent) {
    const payment = await this.payments.findByInvoice(this.provider.name, event.invoiceId);
    if (!payment) {
      this.logger.warn({ invoice: event.invoiceId }, 'Unknown payment invoice');
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }
    if (!moneyEquals(payment.amount, event.amount)) {
      this.logger.warn({ invoice: event.invoiceId }, 'Payment amount mismatch');
      throw new AppError('Payment amount mismatch', 400, 'AMOUNT_MISMATCH');
    }
    if (event.status !== 'succeeded')
      return this.payments.setStatus(String(payment._id), event.status, event.metadata);
    if (payment.status === 'succeeded' && payment.processedAt) return null;
    await this.payments.setStatus(String(payment._id), 'succeeded', event.metadata);
    return this.processSuccess(String(payment._id));
  }
  async processSuccess(paymentId: string) {
    const claimed = await this.payments.claimForProcessing(paymentId);
    if (!claimed) return null;
    try {
      const subscription = await this.subscriptions.activate(claimed);
      this.logger.info({ payment: claimed.publicId }, '✅ PAYMENT SUCCEEDED');
      this.logger.info(
        { telegramId: claimed.telegramId, expiresAt: subscription.expiresAt },
        '✅ SUBSCRIPTION ACTIVATED',
      );
      return { payment: claimed, subscription };
    } catch (error) {
      await this.payments.releaseProcessing(paymentId);
      throw error;
    }
  }
  async findByToken(token: string) {
    const record = await this.returnTokens.resolve(token);
    return record ? this.payments.findById(String(record.paymentId)) : null;
  }
  findByPublicId(id: string) {
    return this.payments.findByPublicId(id);
  }
  async refreshStatus(publicId: string) {
    const payment = await this.payments.findByPublicId(publicId);
    if (!payment) return null;
    if (payment.status !== 'pending' || !payment.providerInvoiceId) return payment;
    const status = await this.provider.getPaymentStatus(payment.providerInvoiceId);
    if (status === 'succeeded') {
      await this.payments.setStatus(String(payment._id), 'succeeded');
      await this.processSuccess(String(payment._id));
      return this.payments.findById(String(payment._id));
    }
    if (status !== 'pending') return this.payments.setStatus(String(payment._id), status);
    return payment;
  }
  async processSuccessAfterMock(paymentId: string) {
    if (this.config.NODE_ENV === 'production' || this.provider.name !== 'mock')
      throw new AppError('Mock payments are disabled', 403);
    const payment = await this.payments.findById(paymentId);
    if (
      !payment ||
      payment.provider !== 'mock' ||
      !['created', 'pending', 'succeeded'].includes(payment.status)
    )
      return null;
    if (payment.status !== 'succeeded')
      await this.payments.setStatus(paymentId, 'succeeded', { confirmedByAdmin: true });
    return this.processSuccess(paymentId);
  }
}
