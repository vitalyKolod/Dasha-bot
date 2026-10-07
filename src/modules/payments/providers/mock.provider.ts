import type { PaymentProvider } from '../PaymentProvider.js';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ProviderPaymentStatus,
  VerifiedWebhookEvent,
  WebhookPayload,
} from '../payment.types.js';
import { AppError } from '../../../shared/errors/AppError.js';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    return Promise.resolve({
      checkoutUrl: input.returnUrl,
      providerInvoiceId: input.invoiceId,
      providerPaymentId: `mock_${input.paymentId}`,
    });
  }
  getPaymentStatus(): Promise<ProviderPaymentStatus> {
    return Promise.resolve('pending');
  }
  verifyWebhook(payload: WebhookPayload): VerifiedWebhookEvent {
    if (!payload.invoiceId || !payload.amount || !payload.status)
      throw new AppError('Invalid mock webhook');
    if (!['pending', 'succeeded', 'canceled', 'failed'].includes(payload.status))
      throw new AppError('Invalid mock status');
    return {
      invoiceId: payload.invoiceId,
      amount: Number(payload.amount),
      status: payload.status as ProviderPaymentStatus,
      metadata: payload,
    };
  }
}
