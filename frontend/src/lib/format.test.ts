import { describe, expect, it } from 'vitest';
import { formatPct, shortId, statusTone } from './format';

describe('format helpers', () => {
  it('formats percentages', () => {
    expect(formatPct(0.825)).toBe('82.5%');
    expect(formatPct(Number.NaN)).toBe('—');
  });

  it('shortens ids', () => {
    expect(shortId('abc', 10)).toBe('abc');
    expect(shortId('abcdefghijklmnopqrst', 10)).toBe('abcdefghij…');
  });

  it('maps status tones', () => {
    expect(statusTone('OPEN')).toContain('teal');
    expect(statusTone('WAITING_AGENT')).toContain('signal');
    expect(statusTone('RESOLVED')).toContain('ok');
  });
});
