import pino, { type Logger } from 'pino';
import type { AppConfig } from '../config/env.js';

export function createLogger(config: Pick<AppConfig, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  const base = {
    level: config.LOG_LEVEL,
    redact: {
      paths: ['BOT_TOKEN', '*.token', '*.password', '*.signature', 'req.headers.authorization'],
      censor: '[REDACTED]',
    },
  };
  return config.NODE_ENV === 'development'
    ? pino({
        ...base,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      })
    : pino(base);
}

export function logBanner(logger: Logger, title: string): void {
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${title}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}
