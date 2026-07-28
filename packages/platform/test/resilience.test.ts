import { computeBackoffMs, createCircuitBreaker, withRetry } from '../src/resilience/index.js';
import { CircuitOpenError, TimeoutError } from '../src/resilience/index.js';
import { describe, expect, it, vi } from 'vitest';

describe('computeBackoffMs', () => {
  it('stays within [0, base*2^attempt] and respects max', () => {
    for (let i = 0; i < 20; i++) {
      const d = computeBackoffMs(3, { baseMs: 100, maxMs: 500, random: () => 0.999 });
      expect(d).toBeLessThanOrEqual(500);
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('withRetry', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxAttempts: 3, sleep: async () => undefined })).resolves.toBe(
      'ok',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, {
      maxAttempts: 5,
      baseBackoffMs: 1,
      sleep: async () => undefined,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops after maxAttempts and never retries forever', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    await expect(
      withRetry(fn, { maxAttempts: 3, baseBackoffMs: 1, sleep: async () => undefined }),
    ).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('bad request'));
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        isRetryable: () => false,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('times out a hanging call', async () => {
    await expect(
      withRetry(() => new Promise(() => undefined), {
        maxAttempts: 1,
        timeoutMs: 20,
        sleep: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe('circuit breaker', () => {
  it('opens after sustained failures and fails fast', async () => {
    const breaker = createCircuitBreaker('test', {
      failureThreshold: 0.5,
      minRequests: 4,
      resetMs: 60_000,
      windowSize: 10,
    });

    for (let i = 0; i < 4; i++) {
      await expect(breaker.exec(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    }
    expect(breaker.getState()).toBe('OPEN');
    await expect(breaker.exec(async () => 'ok')).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('transitions OPEN → HALF_OPEN after reset and closes on success', async () => {
    let now = 1_000;
    const breaker = createCircuitBreaker('probe', {
      failureThreshold: 0.5,
      minRequests: 2,
      resetMs: 100,
      windowSize: 10,
      now: () => now,
    });

    await expect(breaker.exec(async () => Promise.reject(new Error('x')))).rejects.toThrow();
    await expect(breaker.exec(async () => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');

    now += 150;
    expect(breaker.getState()).toBe('HALF_OPEN');
    await expect(breaker.exec(async () => 'recovered')).resolves.toBe('recovered');
    expect(breaker.getState()).toBe('CLOSED');
  });
});
