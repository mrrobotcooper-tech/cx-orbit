import { z } from 'zod';

/** Log levels supported by Pino. */
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * Environment fields common to every service. Individual services extend
 * this with their own schema (ports, dependency URLs, etc.).
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});
export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Validate `process.env` against a schema. On failure it prints the exact
 * problems and exits the process — fail fast rather than boot half-configured.
 * Secrets are never printed (only the field name and the validation message).
 */
export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    console.error(`[config] Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return result.data;
}
