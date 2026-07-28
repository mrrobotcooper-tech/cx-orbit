/**
 * Full-jitter exponential backoff (AWS-style): delay ∈ [0, min(cap, base * 2^attempt)).
 * Avoids thundering herds when many clients retry together (ADR-006).
 */
export function computeBackoffMs(
  attempt: number,
  options: { baseMs?: number; maxMs?: number; random?: () => number } = {},
): number {
  const baseMs = options.baseMs ?? 200;
  const maxMs = options.maxMs ?? 30_000;
  const random = options.random ?? Math.random;
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.floor(random() * exp);
}

export type RetryableClassifier = (err: unknown) => boolean;

export interface RetryOptions {
  maxAttempts: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  /** Per-attempt timeout; if set, wraps each call. */
  timeoutMs?: number;
  isRetryable?: RetryableClassifier;
  onRetry?: (info: { attempt: number; error: unknown; delayMs: number }) => void;
  sleep?: (ms: number) => Promise<void>;
}

export class TimeoutError extends Error {
  constructor(message = 'operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Execute `fn` with bounded retries, exponential backoff + full jitter, and optional
 * per-attempt timeout. Never retries forever (ADR-006).
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts);
  const isRetryable = options.isRetryable ?? (() => true);
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const work = fn();
      return options.timeoutMs !== undefined
        ? await withTimeout(work, options.timeoutMs)
        : await work;
    } catch (err) {
      lastError = err;
      const isLast = attempt >= maxAttempts - 1;
      if (isLast || !isRetryable(err)) throw err;
      const delayMs = computeBackoffMs(attempt, {
        ...(options.baseBackoffMs !== undefined ? { baseMs: options.baseBackoffMs } : {}),
        ...(options.maxBackoffMs !== undefined ? { maxMs: options.maxBackoffMs } : {}),
      });
      options.onRetry?.({ attempt: attempt + 1, error: err, delayMs });
      await sleep(delayMs);
    }
  }
  throw lastError;
}
