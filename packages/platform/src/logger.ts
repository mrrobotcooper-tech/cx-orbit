import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger };

/**
 * Fields that must never appear in logs. Pino redacts these paths across all
 * log objects (see ADR-007: never log passwords, tokens, API keys, secrets).
 */
const REDACT_PATHS = [
  'password',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.secret',
];

export interface CreateLoggerOptions {
  service: string;
  level?: string;
  /** Pretty-print in development; JSON otherwise. Defaults to false (JSON). */
  pretty?: boolean;
}

/**
 * Structured JSON logger with secret redaction and a `service` binding on
 * every line. All services use this so logs are uniform and queryable in Loki.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const opts: LoggerOptions = {
    level: options.level ?? 'info',
    base: { service: options.service },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return pino(opts);
}
