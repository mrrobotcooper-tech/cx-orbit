export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Failure rate (0–1) that opens the breaker. Default 0.5. */
  failureThreshold?: number;
  /** Minimum requests in the window before the rate is evaluated. Default 5. */
  minRequests?: number;
  /** How long to stay OPEN before probing (HALF_OPEN), in ms. Default 15_000. */
  resetMs?: number;
  /** Sliding window size (number of recent outcomes). Default 20. */
  windowSize?: number;
  now?: () => number;
}

export interface CircuitBreaker {
  readonly name: string;
  getState(): CircuitState;
  /** Run `fn` if the breaker allows; otherwise throw CircuitOpenError. */
  exec<T>(fn: () => Promise<T>): Promise<T>;
}

export class CircuitOpenError extends Error {
  constructor(readonly breakerName: string) {
    super(`circuit breaker open: ${breakerName}`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * In-memory circuit breaker (CLOSED → OPEN → HALF_OPEN). Suitable for a single
 * process; Redis-backed sharing can wrap this later for multi-instance (ADR-006).
 */
export function createCircuitBreaker(
  name: string,
  options: CircuitBreakerOptions = {},
): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 0.5;
  const minRequests = options.minRequests ?? 5;
  const resetMs = options.resetMs ?? 15_000;
  const windowSize = options.windowSize ?? 20;
  const now = options.now ?? Date.now;

  let state: CircuitState = 'CLOSED';
  let openedAt = 0;
  const outcomes: boolean[] = []; // true = success

  function record(success: boolean): void {
    outcomes.push(success);
    if (outcomes.length > windowSize) outcomes.shift();
  }

  function failureRate(): number {
    if (outcomes.length === 0) return 0;
    const failures = outcomes.filter((o) => !o).length;
    return failures / outcomes.length;
  }

  function maybeOpen(): void {
    if (outcomes.length >= minRequests && failureRate() >= failureThreshold) {
      state = 'OPEN';
      openedAt = now();
    }
  }

  return {
    name,
    getState: () => {
      if (state === 'OPEN' && now() - openedAt >= resetMs) {
        state = 'HALF_OPEN';
      }
      return state;
    },
    async exec<T>(fn: () => Promise<T>): Promise<T> {
      const current = this.getState();
      if (current === 'OPEN') {
        throw new CircuitOpenError(name);
      }

      try {
        const result = await fn();
        record(true);
        if (state === 'HALF_OPEN') state = 'CLOSED';
        return result;
      } catch (err) {
        record(false);
        if (state === 'HALF_OPEN') {
          state = 'OPEN';
          openedAt = now();
        } else {
          maybeOpen();
        }
        throw err;
      }
    },
  };
}
