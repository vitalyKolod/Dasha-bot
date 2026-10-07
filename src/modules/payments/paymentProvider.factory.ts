import type { AppConfig } from '../../config/env.js';
import type { PaymentProvider } from './PaymentProvider.js';
import { MockPaymentProvider } from './providers/mock.provider.js';
import { RobokassaPaymentProvider } from './providers/robokassa.provider.js';

export function createPaymentProvider(config: AppConfig): PaymentProvider {
  if (config.PAYMENT_PROVIDER === 'mock') return new MockPaymentProvider();
  return new RobokassaPaymentProvider({
    merchantLogin: config.ROBOKASSA_MERCHANT_LOGIN!,
    password1: (config.ROBOKASSA_TEST_MODE
      ? config.ROBOKASSA_TEST_PASSWORD_1
      : config.ROBOKASSA_PASSWORD_1)!,
    password2: (config.ROBOKASSA_TEST_MODE
      ? config.ROBOKASSA_TEST_PASSWORD_2
      : config.ROBOKASSA_PASSWORD_2)!,
    testMode: config.ROBOKASSA_TEST_MODE,
  });
}
