import type { Context } from 'grammy';
import type { Logger } from 'pino';
import type { AppConfig } from '../config/env.js';
import type { UserService } from '../modules/users/user.service.js';
import type { SubscriptionService } from '../modules/subscriptions/subscription.service.js';
import type { PaymentService } from '../modules/payments/payment.service.js';
import type { AccessService } from '../modules/access/access.service.js';
export interface Services {
  users: UserService;
  subscriptions: SubscriptionService;
  payments: PaymentService;
  access: AccessService;
}
export interface BotContext extends Context {
  config: AppConfig;
  logger: Logger;
  services: Services;
}
