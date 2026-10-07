export type ProviderPaymentStatus = 'pending' | 'succeeded' | 'canceled' | 'failed';
export interface CreateCheckoutInput {
  paymentId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
}
export interface CreateCheckoutResult {
  checkoutUrl: string;
  providerPaymentId?: string;
  providerInvoiceId: string;
}
export interface WebhookPayload {
  [key: string]: string | undefined;
}
export interface VerifiedWebhookEvent {
  invoiceId: string;
  amount: number;
  status: ProviderPaymentStatus;
  providerPaymentId?: string;
  metadata: Record<string, unknown>;
}
