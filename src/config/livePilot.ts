import type { AppConfig } from './env.js';

export const LIVE_PILOT_AMOUNT_KOPECKS = 5_000;

export const canUseTestPayment = (config: AppConfig, telegramId: string): boolean =>
  config.PAYMENT_PROVIDER === 'robokassa' &&
  (config.ROBOKASSA_TEST_MODE ||
    (config.ROBOKASSA_LIVE_PILOT_ENABLED &&
      (config.adminIds.has(telegramId) || config.livePilotIds.has(telegramId))));

export const isLivePilot = (config: AppConfig): boolean =>
  config.PAYMENT_PROVIDER === 'robokassa' &&
  config.ROBOKASSA_LIVE_PILOT_ENABLED &&
  !config.ROBOKASSA_TEST_MODE;
