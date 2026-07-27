import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/index.js';

describe('createLogger', () => {
  it('binds the service name and exposes standard methods', () => {
    const logger = createLogger({ service: 'svc', level: 'silent' });
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(logger.bindings().service).toBe('svc');
  });
});
