import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { baseEnvSchema, loadEnv } from '../src/index.js';

describe('loadEnv', () => {
  it('applies defaults for a valid (empty) environment', () => {
    const env = loadEnv(baseEnvSchema, {} as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('honors provided overrides', () => {
    const env = loadEnv(baseEnvSchema, {
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
    } as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('production');
    expect(env.LOG_LEVEL).toBe('warn');
  });

  it('prints issues and exits on invalid configuration', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const schema = z.object({ PORT: z.string().regex(/^\d+$/) });
    expect(() => loadEnv(schema, {} as NodeJS.ProcessEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
