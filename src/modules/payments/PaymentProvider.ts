import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ProviderPaymentStatus,
  VerifiedWebhookEvent,
  WebhookPayload,
} from './payment.types.js';
export interface PaymentProvider {
  readonly name: 'mock' | 'robokassa';
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  getPaymentStatus(providerInvoiceId: string): Promise<ProviderPaymentStatus>;
  verifyWebhook(payload: WebhookPayload): VerifiedWebhookEvent;
}
