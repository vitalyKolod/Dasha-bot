import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ quiet: true });

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HTTP_HOST: z.ipv4().default('127.0.0.1'),
    APP_BASE_URL: z.url().default('http://localhost:3000'),
    PUBLIC_BASE_URL: optionalString.pipe(z.url().optional()),
    BOT_TOKEN: z.string().trim().min(1, 'BOT_TOKEN is required'),
    TELEGRAM_API_IP: z.preprocess(emptyToUndefined, z.ipv4().optional()),
    BOT_USERNAME: optionalString,
    MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),
    PRIVATE_CLUB_CHAT_ID: optionalString,
    ADMIN_IDS: z.string().default(''),
    SUPPORT_USERNAME: optionalString,
    OFFER_URL: optionalString.pipe(z.url().optional()),
    PRIVACY_URL: optionalString.pipe(z.url().optional()),
    OFFER_VERSION: z.string().trim().min(1).default('2026-09-21'),
    START_IMAGE_FILE_ID: optionalString,
    START_VIDEO_FILE_ID: optionalString,
    PAYMENT_PROVIDER: z.enum(['mock', 'robokassa']).default('mock'),
    ROBOKASSA_MERCHANT_LOGIN: optionalString,
    ROBOKASSA_TEST_PASSWORD_1: optionalString,
    ROBOKASSA_TEST_PASSWORD_2: optionalString,
    ROBOKASSA_PASSWORD_1: optionalString,
    ROBOKASSA_PASSWORD_2: optionalString,
    ROBOKASSA_HASH_ALGORITHM: z.literal('SHA256').default('SHA256'),
    ROBOKASSA_TEST_MODE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('debug'),
    PAYMENT_RETURN_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60),
    INVITE_LINK_TTL_HOURS: z.coerce.number().int().positive().default(24),
    REMINDER_CRON: z.string().default('*/15 * * * *'),
    ADMIN_EXPIRING_DAYS: z.coerce.number().int().min(1).max(365).default(3),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'mock') {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
        message: 'mock is forbidden in production',
      });
    }
    if (env.PAYMENT_PROVIDER === 'robokassa') {
      if (!env.PUBLIC_BASE_URL || !env.PUBLIC_BASE_URL.startsWith('https://'))
        ctx.addIssue({
          code: 'custom',
          path: ['PUBLIC_BASE_URL'],
          message: 'public HTTPS URL is required for Robokassa',
        });
      const keys = env.ROBOKASSA_TEST_MODE
        ? ([
            'ROBOKASSA_MERCHANT_LOGIN',
            'ROBOKASSA_TEST_PASSWORD_1',
            'ROBOKASSA_TEST_PASSWORD_2',
          ] as const)
        : (['ROBOKASSA_MERCHANT_LOGIN', 'ROBOKASSA_PASSWORD_1', 'ROBOKASSA_PASSWORD_2'] as const);
      for (const key of keys) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required for Robokassa`,
          });
      }
    }
  });

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`CONFIG ERROR\n${missing}`);
  }
  const adminIds = result.data.ADMIN_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return { ...result.data, adminIds: new Set(adminIds) };
}
