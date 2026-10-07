import type { PaymentProvider } from '../PaymentProvider.js';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ProviderPaymentStatus,
  VerifiedWebhookEvent,
  WebhookPayload,
} from '../payment.types.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { sha256, safeEqualHex } from '../../../shared/utils/crypto.js';

interface RobokassaOptions {
  merchantLogin: string;
  password1: string;
  password2: string;
  testMode: boolean;
}
const formatAmount = (kopecks: number) => (kopecks / 100).toFixed(2);

export class RobokassaPaymentProvider implements PaymentProvider {
  readonly name = 'robokassa' as const;
  constructor(private readonly options: RobokassaOptions) {}
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const amount = formatAmount(input.amount);
    const signature = sha256(
      `${this.options.merchantLogin}:${amount}:${input.invoiceId}:${this.options.password1}`,
    );
    const url = new URL('https://auth.robokassa.ru/Merchant/Index.aspx');
    url.search = new URLSearchParams({
      MerchantLogin: this.options.merchantLogin,
      OutSum: amount,
      InvId: input.invoiceId,
      Description: input.description.slice(0, 100),
      SignatureValue: signature,
      Culture: 'ru',
      Encoding: 'utf-8',
      ...(this.options.testMode ? { IsTest: '1' } : {}),
    }).toString();
    return Promise.resolve({
      checkoutUrl: url.toString(),
      providerInvoiceId: input.invoiceId,
      providerPaymentId: input.invoiceId,
    });
  }
  getPaymentStatus(): Promise<ProviderPaymentStatus> {
    return Promise.resolve('pending');
  }
  verifyWebhook(payload: WebhookPayload): VerifiedWebhookEvent {
    const amountText = payload.OutSum ?? payload.outSum;
    const invoiceId = payload.InvId ?? payload.InvID ?? payload.invoiceId;
    const signature = payload.SignatureValue ?? payload.signatureValue;
    if (!amountText || !invoiceId || !signature)
      throw new AppError('Invalid Robokassa webhook', 400, 'INVALID_WEBHOOK');
    const shp = Object.entries(payload)
      .filter(([key, value]) => key.toLowerCase().startsWith('shp_') && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    const signatureBase = [amountText, invoiceId, this.options.password2, ...shp].join(':');
    if (!safeEqualHex(signature, sha256(signatureBase)))
      throw new AppError('Invalid Robokassa signature', 401, 'INVALID_SIGNATURE');
    const match = /^(\d+)(?:\.(\d{1,2})(?:0{0,4})?)?$/.exec(amountText);
    if (!match) throw new AppError('Invalid amount', 400, 'INVALID_AMOUNT');
    const kopecks = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    if (!Number.isSafeInteger(kopecks)) throw new AppError('Invalid amount', 400, 'INVALID_AMOUNT');
    return { invoiceId, amount: kopecks, status: 'succeeded', metadata: {} };
  }
}
